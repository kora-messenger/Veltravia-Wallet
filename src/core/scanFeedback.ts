/**
 * Capture feedback for the QR scanner (ScanFeedbackModule.kt).
 *
 * `capture()` = the bell + a haptic tick, used when the camera catches a code.
 * `bell()` = sound only, used when a code is read from a picked image (there is
 * nothing to "catch", so no vibration).
 *
 * Trust ships no scanner sound and signals a capture with a short vibration;
 * the bell is Ijezie's addition (Oct 29). Every call is best-effort: a missing
 * native module (Jest, iOS until ported) or a muted phone must never stop a scan.
 */
import { NativeModules, Vibration } from 'react-native';

// read at call time, so a module that registers late (or is absent) is handled
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const native = () => (NativeModules as any).VeltraviaScanFeedback;

/** Bell + tick. */
export function captureFeedback(): void {
  try {
    const n = native();
    if (n?.capture) n.capture();
    else Vibration.vibrate(35);        // no native module: keep at least the haptic
  } catch {
    // cosmetic only
  }
}

/** Bell without the tick (gallery read). */
export function captureBell(): void {
  try {
    native()?.bell?.();
  } catch {
    // cosmetic only
  }
}
