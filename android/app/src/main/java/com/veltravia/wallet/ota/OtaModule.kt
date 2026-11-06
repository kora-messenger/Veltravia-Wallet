package com.veltravia.wallet.ota

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The only way JS can touch the out-of-band bundle.
 *
 * Deliberately small: JS decides (after verifying the signed manifest with the
 * key pinned in the app) and calls install; the native side does the download,
 * the hash check and the atomic swap. JS cannot hand over arbitrary bytes, so a
 * compromised JS context cannot write a bundle that was not signed.
 */
class OtaModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "VeltraviaOta"

  @ReactMethod
  fun state(promise: Promise) {
    try {
      val s = OtaStore.state(reactContext)
      val map = Arguments.createMap()
      map.putString("version", s["version"] as? String)
      map.putString("sha256", s["sha256"] as? String)
      map.putDouble("size", ((s["size"] as? Long) ?: 0L).toDouble())
      map.putInt("attempts", (s["attempts"] as? Int) ?: 0)
      map.putBoolean("bundlePresent", (s["bundlePresent"] as? Boolean) ?: false)
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("ota_state_failed", e)
    }
  }

  @ReactMethod
  fun install(url: String, sha256: String, version: String, promise: Promise) {
    Thread {
      try {
        promise.resolve(OtaStore.install(reactContext, url, sha256, version))
      } catch (e: Exception) {
        promise.reject("ota_install_failed", e)
      }
    }.start()
  }

  @ReactMethod
  fun confirmBoot() {
    OtaStore.confirmBoot(reactContext)
  }

  @ReactMethod
  fun clear() {
    OtaStore.clear(reactContext)
  }
}
