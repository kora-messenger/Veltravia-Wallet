/**
 * Veltravia Wallet - "does this device actually have an account?"
 *
 * The app used to infer this from `hasPasscode()`. That is wrong: onboarding
 * saves the passcode BEFORE the account exists (passcode -> create/import), so
 * a login the user abandoned left a passcode behind and the next cold start
 * treated the device as an existing account: it locked, and unlocking dropped
 * the user on Home with no wallet. See Ijezie, 31 Oct 2026.
 *
 * The truth is the seed: an account exists once a phrase has been stored. This
 * module keeps a cheap, unprotected marker so the boot path never has to touch
 * the biometric-protected seed item (reading that pops the OS prompt).
 *
 * Tri-state on purpose:
 *   yes     - an account was created/imported on this device
 *   no      - definitely none: onboarding must run and any stray passcode goes
 *   unknown - cannot tell right now (old install where the keychain refused);
 *             treat as yes so nothing is ever destroyed on a guess
 */
import { readSettings, writeSettings } from './secureStorage';
import { hasWallet } from './secureStorage';
import { hasPasscode } from './passcode';

export type AccountState = 'yes' | 'no' | 'unknown';

const KEY = 'accountState';

/** Cheap, prompt-free answer when the marker is already written. */
export async function readAccountMarker(): Promise<AccountState | null> {
  try {
    const s = await readSettings();
    const v = s?.[KEY];
    return v === 'yes' || v === 'no' ? v : null;
  } catch {
    return null;
  }
}

export async function markAccountCreated(): Promise<void> {
  try {
    await writeSettings({ [KEY]: 'yes' });
  } catch {
    /* the seed is what matters; the marker is an optimisation */
  }
}

export async function markNoAccount(): Promise<void> {
  try {
    await writeSettings({ [KEY]: 'no' });
  } catch {
    /* nothing to do */
  }
}

/**
 * Resolve the state, migrating installs that predate the marker.
 *
 * Migration ladder (never destructive on a guess):
 *   no passcode            -> fresh device, record 'no'
 *   passcode + seed found  -> existing account, record 'yes'
 *   passcode + no seed     -> an abandoned login, record 'no' (caller clears
 *                             the orphan passcode)
 *   keychain error/prompt  -> 'unknown', nothing written, try again next boot
 */
export async function resolveAccountState(): Promise<AccountState> {
  const marker = await readAccountMarker();
  if (marker) return marker;

  let pass = false;
  try {
    pass = await hasPasscode();
  } catch {
    return 'unknown';
  }
  if (!pass) {
    await markNoAccount();
    return 'no';
  }

  try {
    const wallet = await hasWallet();
    if (wallet) {
      await markAccountCreated();
      return 'yes';
    }
    await markNoAccount();
    return 'no';
  } catch {
    // The seed item is biometric-protected: a cancelled prompt is NOT proof
    // that no account exists, so keep the old (safe) answer and write nothing.
    return 'unknown';
  }
}
