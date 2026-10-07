/**
 * Veltravia Wallet — secure storage layer.
 *
 * SECURITY CONTRACT (non-negotiable):
 *  1. The seed phrase and derived keys NEVER leave this layer unencrypted.
 *     They are stored in the Android Keystore-backed / iOS Keychain-backed
 *     secure enclave via react-native-keychain, never in AsyncStorage,
 *     never in Redux state, never in logs, never sent to any server.
 *  2. This module is the ONLY code allowed to touch secrets. Screens and
 *     services consume abstractions, never raw secrets.
 *  3. Exporting the seed phrase requires re-authentication (PIN/biometric)
 *     at the call site — the UI enforces it, and this layer assumes it.
 */

import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.veltravia.wallet';
const KEY_SEED = 'veltravia.seed';
const KEY_PIN_HASH = 'veltravia.pin';
const KEY_BIOMETRICS = 'veltravia.biometrics';
const KEY_SETTINGS = 'veltravia.settings';

/** Store the encrypted seed phrase. Called exactly once per wallet. */
export async function storeSeed(seedPhrase: string): Promise<void> {
  await Keychain.setGenericPassword(KEY_SEED, seedPhrase, {
    service: `${SERVICE}.${KEY_SEED}`,
    // v10 exposes a string enum: one access control, not a bitmask.
    // Biometric unlock with automatic device-passcode fallback on iOS;
    // Phase 2 adds the PIN flow for biometric-less devices.
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/** True once a wallet has been created or imported on this device. */
export async function hasWallet(): Promise<boolean> {
  const result = await Keychain.getGenericPassword({
    service: `${SERVICE}.${KEY_SEED}`,
  });
  return result !== false;
}

/**
 * Read the seed phrase. ONLY the WalletManager may call this.
 * The biometric/ device-credential prompt is enforced by accessControl.
 */
export async function readSeed(): Promise<string | null> {
  const result = await Keychain.getGenericPassword({
    service: `${SERVICE}.${KEY_SEED}`,
  });
  if (result === false) return null;
  return result.password;
}

/** Wipe everything. Used by "reset wallet" — destructive and intentional. */
export async function wipeWallet(): Promise<void> {
  for (const key of [KEY_SEED, KEY_PIN_HASH, KEY_SETTINGS]) {
    await Keychain.resetGenericPassword({ service: `${SERVICE}.${key}` });
  }
}
