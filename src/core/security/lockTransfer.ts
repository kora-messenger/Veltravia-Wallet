/**
 * Veltravia Wallet — lock state travels with a paired device.
 *
 * A phone that holds the recovery phrase holds the wallet. If it arrived there by
 * pairing and the old phone was locked, the new one must arrive LOCKED: anything
 * else would mean adding a device silently loosened the wallet, and the user would
 * be looking at two phones that disagree about whether money can move.
 *
 * So pairing carries two things, and nothing more:
 *
 *   • the lock FLAG per wallet (walletId -> locked), which is a boolean, not a secret;
 *   • the security-password VERIFIER ("salt:digest"), so the same password the user
 *     already knows opens the same wallet on the new phone.
 *
 * It never carries the password itself — we do not have it, only its digest. The
 * honest trade-off: a verifier can be brute-forced offline by whoever holds it.
 * That is acceptable here because the same sealed envelope already carries the
 * recovery phrase, which is strictly more powerful; and the alternative (no lock on
 * the new device) is worse. The digest is salted and iterated (see passcode.digest),
 * and the transfer happens only inside the pairing box, sealed to the new phone's
 * one-time key.
 *
 * Biometrics deliberately do NOT travel: they are the new phone's own hardware and
 * enrolment, and it still needs a passcode/biometric of its own for the second step.
 * Importing never overwrites a credential this device already has, so a local
 * password can never be replaced by one from another device.
 */
import { allWalletLocks, refreshWalletLocks, setWalletLocked } from './walletLock';
import {
  adoptSecurityPasswordVerifier,
  listSecurityPasswordWallets,
  readSecurityPasswordVerifier,
} from '../storage/securityPassword';

export interface LockMaterial {
  /** walletId -> locked. */
  locked: Record<string, boolean>;
  /** walletId -> "salt:digest" verifier. Never the password. */
  verifiers: Record<string, string>;
  at: number;
}

/** Wallets we know about on this device: locked ones, plus ones with a password. */
async function knownWallets(): Promise<string[]> {
  const ids = new Set<string>(Object.keys(allWalletLocks()));
  for (const id of await listSecurityPasswordWallets()) ids.add(id);
  // 'default' is the wallet every install has.
  ids.add('default');
  return [...ids];
}

/** Snapshot what protects this device, for the sealed pairing box. */
export async function exportLockMaterial(): Promise<LockMaterial> {
  await refreshWalletLocks();
  const locked = allWalletLocks();
  const verifiers: Record<string, string> = {};
  for (const id of await knownWallets()) {
    const verifier = await readSecurityPasswordVerifier(id);
    if (verifier) verifiers[id] = verifier;
  }
  return { locked, verifiers, at: Date.now() };
}

export interface LockImportResult {
  /** Wallets this device now knows are locked. */
  locked: string[];
  /** Wallets whose password verifier was adopted from the other device. */
  passwords: string[];
}

/**
 * Apply a host's protection state to this device.
 *
 * Conservative by construction: a lock is only ever ADDED here (a fresh device has
 * no flags of its own), and a password verifier is only adopted when this device has
 * none for that wallet. Nothing is unlocked, nothing is overwritten.
 */
export async function importLockMaterial(
  material: LockMaterial | null | undefined,
): Promise<LockImportResult> {
  const result: LockImportResult = { locked: [], passwords: [] };
  if (!material) return result;

  for (const [walletId, isLocked] of Object.entries(material.locked ?? {})) {
    if (isLocked !== true) continue;
    await setWalletLocked(walletId, true);
    result.locked.push(walletId);
  }

  for (const [walletId, verifier] of Object.entries(material.verifiers ?? {})) {
    if (await adoptSecurityPasswordVerifier(walletId, verifier)) {
      result.passwords.push(walletId);
    }
  }

  await refreshWalletLocks();
  return result;
}
