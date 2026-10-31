/**
 * Veltravia Wallet - a passcode the user typed during onboarding, HELD IN
 * MEMORY until there is an account for it to protect.
 *
 * Onboarding asks for the passcode before the wallet exists, so writing it to
 * the keychain at that moment meant an abandoned sign-up left a passcode with
 * no account behind: the next launch locked the app and dropping to Home with
 * no wallet (Ijezie, 31 Oct 2026). Nothing here touches storage: if the app is
 * killed mid-onboarding, the code simply never existed.
 *
 * The flush happens in WalletManager, immediately after the seed is stored, so
 * the passcode and the account land together or not at all.
 */
import { setPasscode } from '../storage/passcode';
import { setBiometricUnlockEnabled } from './biometrics';

interface Pending {
  code: string;
  biometric: boolean;
}

let pending: Pending | null = null;

/** Remember the code the user just chose. Replaces any earlier one. */
export function stagePasscode(code: string, biometric: boolean): void {
  pending = { code, biometric };
}

export function hasPendingPasscode(): boolean {
  return pending !== null;
}

/** Drop a staged code (the flow was abandoned or failed). */
export function clearPendingPasscode(): void {
  pending = null;
}

/**
 * Persist the staged passcode. Called when an account is created or imported.
 * Safe to call when nothing is staged (returns false).
 */
export async function flushPendingPasscode(): Promise<boolean> {
  if (!pending) return false;
  const { code, biometric } = pending;
  pending = null; // never flush twice, even if the write below throws
  try {
    await setBiometricUnlockEnabled(biometric);
    await setPasscode(code);
    return true;
  } catch {
    // Keychain refused (no lock screen on this device): continue without one.
    return false;
  }
}
