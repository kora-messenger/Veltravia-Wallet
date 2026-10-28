package com.veltravia.wallet

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Calendar

/**
 * Native Android date -> time picker chain (the Material dialogs Trust shows
 * for the Perps Activity "Custom" date range: calendar with Cancel / OK, then
 * the clock). Resolves the chosen instant as epoch millis, or null if the user
 * cancels either step. React Native ships no picker, so this stays tiny.
 */
class DateTimePickerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "VeltraviaDateTimePicker"

  @ReactMethod
  fun pick(initialMillis: Double, minMillis: Double, maxMillis: Double, promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.resolve(null)
      return
    }
    activity.runOnUiThread {
      val cal = Calendar.getInstance().apply { timeInMillis = initialMillis.toLong() }
      var settled = false
      fun settle(v: Double?) {
        if (settled) return
        settled = true
        promise.resolve(v)
      }
      val date = DatePickerDialog(
          activity,
          { _, y, m, d ->
            val chosen = Calendar.getInstance().apply {
              timeInMillis = initialMillis.toLong()
              set(Calendar.YEAR, y); set(Calendar.MONTH, m); set(Calendar.DAY_OF_MONTH, d)
            }
            val time = TimePickerDialog(
                activity,
                { _, h, min ->
                  chosen.set(Calendar.HOUR_OF_DAY, h)
                  chosen.set(Calendar.MINUTE, min)
                  chosen.set(Calendar.SECOND, 0)
                  chosen.set(Calendar.MILLISECOND, 0)
                  settle(chosen.timeInMillis.toDouble())
                },
                chosen.get(Calendar.HOUR_OF_DAY),
                chosen.get(Calendar.MINUTE),
                false)
            time.setOnCancelListener { settle(null) }
            time.show()
          },
          cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH))
      if (minMillis > 0) date.datePicker.minDate = minMillis.toLong()
      if (maxMillis > 0) date.datePicker.maxDate = maxMillis.toLong()
      date.setOnCancelListener { settle(null) }
      date.show()
    }
  }
}
