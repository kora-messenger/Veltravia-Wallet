package com.veltravia.wallet

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Toggles FLAG_SECURE on the current activity's window.
 *
 * With FLAG_SECURE set the system blocks screenshots and screen recording,
 * and the app's contents are hidden in the recents (app switcher) preview
 * — the same protection Trust Wallet applies on its lock/passcode screens.
 *
 * Passcode entry surfaces set it on mount and clear it on unmount so the
 * rest of the app behaves normally.
 */
class SecureModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "SecureModule"

  @ReactMethod
  fun setFlagSecure(enabled: Boolean) {
    val activity = currentActivity ?: return
    activity.runOnUiThread {
      if (enabled) {
        it.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
      } else {
        it.window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }
}
