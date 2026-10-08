package com.veltravia.wallet

import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    // Must run before super.onCreate: swaps Theme.App.Starting for AppTheme
    // once the first frame is drawn, leaving a clean white handoff.
    installSplashScreen()
    // null (not savedInstanceState): react-native-screens can't restore fragments.
    super.onCreate(null)

    // Edge-to-edge is forced on by RN, which lets JS content slide under the
    // status bar (and JS-side inset lookups can report 0). Pad the content
    // root natively by the real status-bar height so the app always starts
    // below the clock / battery row.
    val content = findViewById<ViewGroup>(android.R.id.content)
    // The padded strip under the status bar shows this view's background:
    // use the DayNight window colour so it matches the app surface.
    paintContentBackground()
    ViewCompat.setOnApplyWindowInsetsListener(content) { v: View, insets: WindowInsetsCompat ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.statusBars())
      v.setPadding(0, bars.top, 0, 0)
      insets
    }
    ViewCompat.requestApplyInsets(content)
  }

  private fun paintContentBackground() {
    findViewById<ViewGroup>(android.R.id.content)
        .setBackgroundColor(resources.getColor(R.color.splashBackground, theme))
  }

  // Fires when the in-app light/dark toggle changes the native night mode.
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    paintContentBackground()
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "VeltraviaWallet"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
