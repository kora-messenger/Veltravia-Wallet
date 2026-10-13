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

export const setFlagSecure = (enabled: boolean): void => {
  try {
    SecureModule?.setFlagSecure?.(enabled);
  } catch {
    // Native module unavailable (e.g. iOS or before JS/native bridge is
    // ready) — never crash the screen over this.
  }
};
