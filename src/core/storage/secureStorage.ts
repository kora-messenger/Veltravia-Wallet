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

/**
 * How strongly the stored seed is bound to hardware.
 *
 *   biometric   the Keystore key needs the enrolled fingerprint/face; enrolling
 *               a new biometric invalidates it (BIOMETRY_CURRENT_SET)
 *   device-lock the key needs the phone's screen lock (PIN/pattern/face)
 *   app-lock    no hardware gate: the record is Keystore-encrypted at rest and
 *               the app's own Wallet Lock is what stands in front of it
 *
 * Only the first is ideal. The other two exist because a phone with no screen
 * lock or no enrolled biometrics made wallet creation fail outright, with the
 * generic "Couldn't finish setting up" (Ijezie, 6 Nov 2026). Refusing to
 * create a wallet is a worse outcome than an honest, weaker binding.
 */
export type SeedProtection = 'biometric' | 'device-lock' | 'app-lock';

const LADDER: { level: SeedProtection; accessControl?: Keychain.ACCESS_CONTROL }[] = [
  { level: 'biometric', accessControl: (Keychain.ACCESS_CONTROL as any).BIOMETRY_CURRENT_SET },
  { level: 'device-lock', accessControl: (Keychain.ACCESS_CONTROL as any).BIOMETRY_ANY_OR_DEVICE_PASSCODE },
  { level: 'app-lock' },
];

/** What this device ended up with, as persisted by storeSeed. */
export async function seedProtection(): Promise<SeedProtection> {
  const s = await readSettings();
  return (s.seedProtection as SeedProtection) ?? 'app-lock';
}

/**
 * Store the encrypted seed phrase. Called exactly once per wallet.
 *
 * Walks the ladder above and reports the level it settled on. If every level
 * fails the error is rethrown with the attempts attached, so the caller can
 * tell the user something true instead of a spinner or a bare "failed".
 */
export async function storeSeed(seedPhrase: string): Promise<void> {
  const failures: string[] = [];
  for (const rung of LADDER) {
    try {
      await Keychain.setGenericPassword(KEY_SEED, seedPhrase, {
        service: `${SERVICE}.${KEY_SEED}`,
        ...(rung.accessControl ? { accessControl: rung.accessControl } : {}),
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      // The seed is the account. Record that here, once, so the boot path can
      // tell a real account from a passcode left behind by an abandoned login
      // without reading this protected item (which would prompt).
      await writeSettings({ accountState: 'yes', seedProtection: rung.level });
      if (rung.level !== 'biometric') {
        console.warn(`[secureStorage] seed stored with ${rung.level} protection; biometric binding unavailable`);
      }
      return;
    } catch (e: any) {
      failures.push(`${rung.level}: ${e?.message ?? e}`);
    }
  }
  const err: any = new Error(failures.join(' | ') || 'secure storage unavailable');
  err.seedFailures = failures;
  throw err;
}

/* ---- app preferences (currency, notifications) ------------------------- */

/** Read the app preferences blob (empty object on first run). */
export async function readSettings(): Promise<Record<string, any>> {
  try {
    const r = await Keychain.getGenericPassword({ service: `${SERVICE}.${KEY_SETTINGS}` });
    if (r && typeof r.password === 'string') return JSON.parse(r.password);
  } catch {
    /* corrupt or absent: start fresh */
  }
  return {};
}

/** Merge-patch the preferences blob and return the new state. */
export async function writeSettings(patch: Record<string, any>): Promise<Record<string, any>> {
  const next = { ...(await readSettings()), ...patch };
  await Keychain.setGenericPassword(KEY_SETTINGS, JSON.stringify(next), {
    service: `${SERVICE}.${KEY_SETTINGS}`,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return next;
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
  // No seed, no account: onboarding must run again from the welcome screen.
  await writeSettings({ accountState: 'no' });
}
