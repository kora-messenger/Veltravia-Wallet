package com.veltravia.wallet

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.drawable.Drawable
import android.net.Uri
import android.util.Base64
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeArray
import android.content.pm.ResolveInfo
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Veltravia receive-QR sharing (mirrors Trust's share sheet, which lists the
 * target apps INSIDE the sheet instead of jumping to the system chooser).
 *
 * The QR is rendered here from the raw module matrix produced by the TS
 * encoder (src/core/qr.ts). Sharing a FILE, not text: chat apps only accept
 * image attachments via stream URIs.
 *
 * Rendering notes:
 *  - PLAIN SQUARE modules with a 4-module quiet zone: this image gets
 *    re-encoded by chat apps, so it uses the most scan-robust form.
 *  - A 4-module coin-coloured disc in the centre, with a 1-module WHITE ring
 *    cleared around it first. The ring matters: without it the tile fuses
 *    with neighbouring dark modules and decodes drop (98% vs 100% in the
 *    OpenCV test). Do not remove it.
 */
class ShareModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "VeltraviaShare"

  /** Apps that can receive an image share, with label + icon (base64 PNG). */
  @ReactMethod
  fun getShareTargets(promise: Promise) {
    try {
      val pm = reactContext.packageManager
      val own = reactContext.packageName
      val probe = Intent(Intent.ACTION_SEND).apply { type = "image/png" }
      val infos: List<ResolveInfo> =
        if (android.os.Build.VERSION.SDK_INT >= 33) {
          pm.queryIntentActivities(
            probe,
            android.content.pm.PackageManager.ResolveInfoFlags.of(0),
          )
        } else {
          @Suppress("DEPRECATION")
          pm.queryIntentActivities(probe, 0)
        }
      val out: WritableArray = WritableNativeArray()
      for (info in infos) {
        val activity = info.activityInfo ?: continue
        if (activity.packageName == own) continue
        val label: String = info.loadLabel(pm)?.toString() ?: continue
        val icon: Drawable = try {
          pm.getActivityIcon(android.content.ComponentName(activity.packageName, activity.name))
        } catch (e: Exception) {
          continue
        }
        val bos = ByteArrayOutputStream()
        drawableToBitmap(icon).compress(Bitmap.CompressFormat.PNG, 100, bos)
        val map: WritableMap = Arguments.createMap()
        map.putString("packageName", activity.packageName)
        map.putString("className", activity.name)
        map.putString("label", label)
        map.putString("icon", Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP))
        out.pushMap(map)
        if (out.size() >= 16) break
      }
      promise.resolve(out)
    } catch (e: Exception) {
      promise.reject("SHARE_TARGETS", e)
    }
  }

  /** Share the QR + text directly to one chosen app. */
  @ReactMethod
  fun shareQrTo(packageName: String, className: String, matrix: Array<BooleanArray>, text: String, logoColor: String) {
    val uri = writeQr(matrix, logoColor)
    val send = Intent(Intent.ACTION_SEND).apply {
      component = android.content.ComponentName(packageName, className)
      type = "image/png"
      putExtra(Intent.EXTRA_STREAM, uri)
      putExtra(Intent.EXTRA_TEXT, text)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      clipData = android.content.ClipData.newRawUri("QR", uri)
    }
    reactContext.startActivity(send)
  }

  /** Open the system chooser with the QR + text (the "More" path). */
  @ReactMethod
  fun shareQrImage(matrix: Array<BooleanArray>, text: String, logoColor: String) {
    val uri = writeQr(matrix, logoColor)
    val send = Intent(Intent.ACTION_SEND).apply {
      type = "image/png"
      putExtra(Intent.EXTRA_STREAM, uri)
      putExtra(Intent.EXTRA_TEXT, text)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      clipData = android.content.ClipData.newRawUri("QR", uri)
    }
    reactContext.startActivity(Intent.createChooser(send, "Share address").apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    })
  }

  /** Render the QR bitmap to the share cache and return its content URI. */
  private fun writeQr(matrix: Array<BooleanArray>, logoColor: String): Uri {
    val n = matrix.size
    if (n == 0) return Uri.EMPTY
    val quiet = 4
    val modulePx = 32
    val size = (n + quiet * 2) * modulePx

    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    canvas.drawColor(android.graphics.Color.WHITE)
    val dark = Paint().apply { color = android.graphics.Color.rgb(0x14, 0x15, 0x2B) }
    val tile = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = try { android.graphics.Color.parseColor(logoColor) } catch (e: Exception) { android.graphics.Color.rgb(0x6C, 0x63, 0xFF) }
    }
    for (r in 0 until n) {
      for (c in 0 until n) {
        if (matrix[r][c]) {
          canvas.drawRect(
            ((c + quiet) * modulePx).toFloat(),
            ((r + quiet) * modulePx).toFloat(),
            ((c + quiet + 1) * modulePx).toFloat(),
            ((r + quiet + 1) * modulePx).toFloat(),
            dark,
          )
        }
      }
    }
    run {
      val tileModules = 4
      val clearStart = ((n - tileModules) / 2 - 1 + quiet) * modulePx
      val clearLen = (tileModules + 2) * modulePx
      canvas.drawRect(
        clearStart.toFloat(),
        clearStart.toFloat(),
        (clearStart + clearLen).toFloat(),
        (clearStart + clearLen).toFloat(),
        Paint().apply { color = android.graphics.Color.WHITE },
      )
      val start = ((n - tileModules) / 2 + quiet) * modulePx
      val len = tileModules * modulePx
      canvas.drawCircle(start + len / 2f, start + len / 2f, len / 2f, tile)
    }

    val file = File(reactContext.cacheDir, "share/veltravia_receive_qr.png")
    file.parentFile?.mkdirs()
    file.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    return FileProvider.getUriForFile(reactContext, "${reactContext.packageName}.fileprovider", file)
  }

  private fun drawableToBitmap(d: Drawable): Bitmap {
    val density = reactContext.resources.displayMetrics.density
    val target = (48 * density).toInt().coerceAtLeast(48)
    val w = if (d.intrinsicWidth > 0) (d.intrinsicWidth * density).toInt().coerceAtMost(target * 2) else target
    val h = if (d.intrinsicHeight > 0) (d.intrinsicHeight * density).toInt().coerceAtMost(target * 2) else target
    val bmp = Bitmap.createBitmap(w.coerceAtLeast(1), h.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    d.setBounds(0, 0, canvas.width, canvas.height)
    d.draw(canvas)
    return bmp
  }
}
