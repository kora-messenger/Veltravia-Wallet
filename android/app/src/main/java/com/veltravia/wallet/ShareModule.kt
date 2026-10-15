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
import com.facebook.react.bridge.ReadableArray
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
  fun shareQrTo(packageName: String, className: String, matrix: ReadableArray, text: String, symbol: String) {
    val uri = writeQr(toMatrix(matrix), symbol)
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
  fun shareQrImage(matrix: ReadableArray, text: String, symbol: String) {
    val uri = writeQr(toMatrix(matrix), symbol)
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

  /** JS nested boolean arrays arrive as ReadableArray — the bridge has no Array<BooleanArray>. */
  private fun toMatrix(arr: ReadableArray?): Array<BooleanArray> {
    if (arr == null) return arrayOf()
    val out = Array(arr.size()) { BooleanArray(0) }
    for (i in 0 until arr.size()) {
      val row = arr.getArray(i) ?: continue
      val b = BooleanArray(row.size())
      for (j in 0 until row.size()) b[j] = row.getBoolean(j)
      out[i] = b
    }
    return out
  }

  /**
   * Render the QR bitmap to the share cache and return its content URI.
   *
   * Trust parity (measured from their shared-QR screenshot):
   *  - 2-module quiet zone, so the code fills the white square (4 looked padded).
   *  - Dark rounded tile in the centre with the actual COIN LOGO on it
   *    (BNB diamonds in yellow, etc), not a flat colour disc.
   * The clearance square keeps a white ring between tile and data modules so
   * decoders stay reliable (OpenCV-tested: ring removal dropped decode to 98%).
   */
  private fun writeQr(matrix: Array<BooleanArray>, symbol: String): Uri {
    val n = matrix.size
    if (n == 0) return Uri.EMPTY
    val quiet = 2
    val modulePx = 32
    val size = (n + quiet * 2) * modulePx

    val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)
    canvas.drawColor(android.graphics.Color.WHITE)
    val dark = Paint().apply { color = android.graphics.Color.rgb(0x14, 0x15, 0x2B) }
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
      // dark rounded tile
      canvas.drawRoundRect(
        start.toFloat(), start.toFloat(), (start + len).toFloat(), (start + len).toFloat(),
        len * 0.28f, len * 0.28f,
        Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.rgb(0x14, 0x15, 0x2B) },
      )
      // coin glyph on the tile
      val id = glyphId(symbol)
      if (id != 0) {
        val d = androidx.core.content.ContextCompat.getDrawable(reactContext, id)
        if (d != null) {
          val inset = len * 0.16f
          d.setBounds(
            (start + inset).toInt(), (start + inset).toInt(),
            (start + len - inset).toInt(), (start + len - inset).toInt(),
          )
          d.draw(canvas)
        }
      }
    }

    val file = File(reactContext.cacheDir, "share/veltravia_receive_qr.png")
    file.parentFile?.mkdirs()
    file.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    return FileProvider.getUriForFile(reactContext, "${reactContext.packageName}.fileprovider", file)
  }

  /** Coin logo drawables (res/drawable/qr_logo_*.xml); MATIC and POL share one. */
  private fun glyphId(symbol: String): Int {
    val res = reactContext.resources
    val pkg = reactContext.packageName
    val norm = symbol.trim().uppercase()
    for (name in listOf("qr_logo_" + norm.lowercase(), if (norm == "POL") "qr_logo_matic" else null)) {
      if (name == null) continue
      val id = res.getIdentifier(name, "drawable", pkg)
      if (id != 0) return id
    }
    return res.getIdentifier("qr_logo_default", "drawable", pkg)
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
