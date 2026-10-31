/**
 * Veltravia Wallet - the one rule that decides whether the app is locked and
 * whether onboarding runs.
 *
 * An ACCOUNT (a stored seed) is the truth. A passcode alone is not: onboarding
 * saves it before the wallet exists, so a login the user walked away from left
 * a passcode behind - the app then locked on next launch and opened Home with
 * no wallet (Ijezie, 31 Oct 2026).
 *
 * A passcode with no account is removed here, so nothing the user set during an
 * unfinished login is kept or asked for again.
 */
import { resolveAccountState } from '../storage/accountState';
import { clearPasscode, hasPasscode } from '../storage/passcode';
import { setBiometricUnlockEnabled } from './biometrics';

export interface AccountGate {
  /** A seed exists: the app has an account and may open Home. */
  hasAccount: boolean;
  /** Lock the app (account + passcode). Never true without an account. */
  lock: boolean;
  /** A stray passcode from an abandoned login was deleted. */
  clearedOrphanPasscode: boolean;
}

export async function resolveAccountGate(): Promise<AccountGate> {
  const account = await resolveAccountState();
  const hasAccount = account !== 'no';

  let has = false;
  try {
    has = await hasPasscode();
  } catch {
    has = false;
  }

  let cleared = false;
  if (!hasAccount && has) {
    await clearPasscode();
    try {
      await setBiometricUnlockEnabled(false);
    } catch {
      /* nothing stored to clear */
    }
    has = false;
    cleared = true;
  }

  return { hasAccount, lock: hasAccount && has, clearedOrphanPasscode: cleared };
}
