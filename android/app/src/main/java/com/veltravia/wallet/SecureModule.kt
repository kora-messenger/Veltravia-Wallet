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
class SecureModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  companion object {
    /** True while JS wants FLAG_SECURE held (lock/passcode screens mounted). */
    @Volatile var jsRequested = false
  }

  override fun getName() = "SecureModule"

  @ReactMethod
  fun setFlagSecure(enabled: Boolean) {
    val activity = reactContext.currentActivity ?: return
    activity.runOnUiThread {
      val flag = android.view.WindowManager.LayoutParams.FLAG_SECURE
      jsRequested = enabled
      if (enabled) activity.window.addFlags(flag) else activity.window.clearFlags(flag)
    }
  }
}
