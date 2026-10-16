/**
 * Native screen-security controls.
 *
 * setFlagSecure(true)  -> Android FLAG_SECURE: screenshots and screen
 *   recording are blocked, and the window is blanked in the recents
 *   (app switcher) preview. This is what Trust Wallet does on its
 *   lock/passcode screens.
 * setFlagSecure(false) -> restores normal behaviour.
 *
 * Used on every surface where the user enters or confirms a passcode.
 */
import { NativeModules } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SecureModule = (NativeModules as any).SecureModule;

/**
 * TEMPORARY (Ijezie, 2026-10-16): screenshots are ALLOWED on the passcode /
 * lock screens for now, so the in-app FLAG_SECURE request is disabled.
 * Flip this back to true to restore Trust-style screenshot blocking.
 * The native onPause blanking of the app-switcher (recents) preview is
 * unaffected — the app never leaks its last screen there.
 */
const BLOCK_SCREENSHOTS_ON_SENSITIVE_SCREENS = false;

export const setFlagSecure = (enabled: boolean): void => {
  try {
    if (enabled && !BLOCK_SCREENSHOTS_ON_SENSITIVE_SCREENS) return;
    SecureModule?.setFlagSecure?.(enabled);
  } catch {
    // Native module unavailable (e.g. iOS or before JS/native bridge is
    // ready) — never crash the screen over this.
  }
};
