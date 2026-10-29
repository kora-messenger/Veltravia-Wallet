package com.veltravia.wallet

import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Capture feedback for the QR scanner: a short two-note bell plus a haptic tick.
 *
 * Trust ships no scanner sound (only support-chat audio) and signals a capture
 * with a vibration pattern; we keep their haptic and add the bell Ijezie asked
 * for. SoundPool is used because it is low-latency (the bell must land with the
 * brackets settling) and it never blocks the UI thread.
 *
 * The bell is a generated 44 KB WAV in res/raw/scan_captured.wav (E6 + B6 with
 * inharmonic partials and an exponential decay) so there is no audio dependency
 * and no third-party sound to license.
 */
class ScanFeedbackModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var pool: SoundPool? = null
  private var bellId = 0

  private fun ensurePool(): SoundPool? {
    pool?.let { return it }
    val p = SoundPool.Builder()
        .setMaxStreams(2)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build())
        .build()
    bellId = p.load(reactApplicationContext, R.raw.scan_captured, 1)
    pool = p
    return p
  }

  private fun vibrator(): Vibrator? {
    val ctx = reactApplicationContext
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val mgr = ctx.getSystemService(VibratorManager::class.java)
      mgr?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      ctx.getSystemService(Vibrator::class.java)
    }
  }

  /** Fire the capture feedback. Safe to call more than once; never throws to JS. */
  @ReactMethod
  fun capture() {
    try {
      ensurePool()?.play(bellId, 1f, 1f, 1, 0, 1f)
      val v = vibrator() ?: return
      if (!v.hasVibrator()) return
      // Trust's tick: one short 35 ms pulse, no repeat
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        v.vibrate(VibrationEffect.createOneShot(35, 160))
      } else {
        @Suppress("DEPRECATION")
        v.vibrate(35)
      }
    } catch (_: Throwable) {
      // feedback is cosmetic: a muted device or a missing vibrator must not break a scan
    }
  }

  /** Bell only, no haptic (used when a read comes from the gallery). */
  @ReactMethod
  fun bell() {
    try {
      ensurePool()?.play(bellId, 1f, 1f, 1, 0, 1f)
    } catch (_: Throwable) {
    }
  }

  override fun invalidate() {
    pool?.release()
    pool = null
    super.invalidate()
  }

  override fun getName() = "VeltraviaScanFeedback"
}
