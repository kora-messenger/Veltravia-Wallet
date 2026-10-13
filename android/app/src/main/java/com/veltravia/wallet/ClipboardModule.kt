package com.veltravia.wallet

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.PersistableBundle
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Minimal clipboard bridge (React Native no longer ships one).
 *
 * Wallet addresses are public, but we still flag the clip as sensitive on
 * Android 13+ so the system keyboard / clipboard overlay does not preview it
 * (same as Trust Wallet's copy of secrets). Only copy is exposed: the app
 * never reads the clipboard.
 */
class ClipboardModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "VeltraviaClipboard"

  @ReactMethod
  fun setString(text: String, sensitive: Boolean) {
    val cm = reactApplicationContext.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
    val clip = ClipData.newPlainText("Veltravia", text)
    if (sensitive && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      clip.description.extras = PersistableBundle().apply {
        putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
      }
    }
    cm.setPrimaryClip(clip)
  }
}
