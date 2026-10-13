package com.veltravia.wallet

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

/**
 * Share the receive QR as an image (Android share sheet shows the picture
 * plus the address text).
 *
 * The QR is rendered here from the raw module matrix produced by the TS
 * encoder (src/core/qr.ts). Sharing a FILE, not text: most chat apps
 * (WhatsApp, Telegram) only accept image attachments via stream URIs.
 *
 * Rendering notes:
 *  - PLAIN SQUARE modules with a 4-module quiet zone: this image will be
 *    re-encoded/rescaled by chat apps on its way to the recipient, so we use
 *    the most scan-robust form possible (same reasoning as QRCode.tsx).
 *  - A 4-module coin-coloured disc (the chain's brand colour, like Trust's
 *    BNB tile) is drawn in the centre, with a 1-module WHITE ring cleared first. The ring matters: without it the tile
 *    fuses with neighbouring dark modules into a bigger blob and decodes drop
 *    to 98% in the OpenCV test; with the ring it is 60/60. Do not remove it.
 */
class ShareModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "VeltraviaShare"

  @ReactMethod
    fun shareQrImage(matrix: Array<BooleanArray>, text: String, logoColor: String) {
    val n = matrix.size
    if (n == 0) return
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
      // 4-module rounded tile in the centre, isolated by a white ring (see header note).
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
      // Coin-coloured disc (same as the on-screen QR centre logo).
      canvas.drawCircle(start + len / 2f, start + len / 2f, len / 2f, tile)
    }

    val file = File(reactContext.cacheDir, "share/veltravia_receive_qr.png")
    file.parentFile?.mkdirs()
    file.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    val uri: Uri = FileProvider.getUriForFile(reactContext, "${reactContext.packageName}.fileprovider", file)

    val send = Intent(Intent.ACTION_SEND).apply {
      type = "image/png"
      putExtra(Intent.EXTRA_STREAM, uri)
      putExtra(Intent.EXTRA_TEXT, text)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    send.clipData = android.content.ClipData.newRawUri("QR", uri)

    reactContext.startActivity(Intent.createChooser(send, "Share address").apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    })
  }
}
