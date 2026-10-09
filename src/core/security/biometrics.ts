/**
 * Veltravia Wallet — biometrics.
 *
 * Uses react-native-keychain (already a dependency, no new native modules):
 * reading a secret stored with ACCESS_CONTROL.BIOMETRY_CURRENT_SET makes
 * Android present the system BiometricPrompt (fingerprint / face), drawn
 * by the OS exactly like Trust's — app icon, "Use fingerprint", etc.
 *
 * On devices with no enrolled biometrics, Keychain falls back to device
 * credentials; `isSupported()` reports false when there is nothing usable
 * and callers degrade gracefully.
 */
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.veltravia.wallet';
const KEY_BIOMarker = 'veltravia.bio.prompt';

export async function isBiometricsSupported(): Promise<boolean> {
  try {
    const t = await Keychain.getSupportedBiometryType();
    return t !== null && t !== (Keychain.BIOMETRY_TYPE as any).NONE;
  } catch {
    return false;
  }
}

/**
 * Presents the OS biometric prompt.
 * Resolves true on success, false when the user cancels / fails.
 * `force` keeps the row honest when called for a flow that has no
 * stored secret yet (e.g. Swift restore): we always have the marker.
 */
export async function promptBiometrics(
  title: string,
  subtitle?: string,
): Promise<boolean> {
  try {
    await Keychain.setGenericPassword('veltravia', 'bio-marker', {
      service: `${SERVICE}.${KEY_BIOMarker}`,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    const res = await Keychain.getGenericPassword({
      service: `${SERVICE}.${KEY_BIOMarker}`,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      authenticationPrompt: { title, subtitle, description: subtitle },
    } as any);
    return res !== false;
  } catch {
    return false;
  }
}
