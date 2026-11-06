package com.veltravia.wallet

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.veltravia.wallet.ota.OtaStore

class MainApplication : Application(), ReactApplication {

  /**
   * A verified out-of-band bundle, if one is installed and still matches its
   * signed hash. OtaStore counts boot attempts and deletes the bundle after
   * three unconfirmed starts, so a bad update falls back to the APK's copy
   * instead of bricking the app.
   */
  private val otaBundlePath: String? by lazy { OtaStore.activeBundlePath(this) }

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      jsBundleFilePath = otaBundlePath,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        add(SecurePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
