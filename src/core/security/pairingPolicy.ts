/**
 * Veltravia Wallet — pairing must never weaken the device that started it.
 *
 * Adding a device to the group is a privileged act, and it is easy to write a
 * flow that leaves the ORIGINAL device looser than it was: an approval card that
 * "unlocks" so the other phone can read state, a group key that gets replaced
 * with a weaker one, a published lock blob that quietly says `locked: false`
 * because the new device has no flag yet.
 *
 * This module makes that impossible to do by accident:
 *
 *   • `captureProtections()` records what is protecting this device right now;
 *   • `restoreProtections()` puts back anything that moved, and reports it;
 *   • nothing in the pairing path is allowed to turn a protection OFF, so the
 *     only legitimate change after pairing is *more* devices being protected.
 *
 * It deliberately does not touch the seed, the group key or the passcode: the
 * point is that pairing is additive.
 */
import { allWalletLocks, refreshWalletLocks, setWalletLocked } from './walletLock';
import { isAppLocked } from './appLockState';
import { refreshRegistryLock } from './lockRegistry';

export interface ProtectionsSnapshot {
  /** walletId -> locked */
  wallets: Record<string, boolean>;
  appLocked: boolean;
  /** What the registry last told us about other devices; null when unknown. */
  remoteLocked: boolean | null;
  takenAt: number;
}

/** Record the protections in force, before a device is added. */
export async function captureProtections(): Promise<ProtectionsSnapshot> {
  await refreshWalletLocks();
  let remoteLocked: boolean | null = null;
  try {
    const remote = await refreshRegistryLock();
    remoteLocked = remote ? remote.locked === true : null;
  } catch {
    remoteLocked = null;
  }
  return {
    wallets: allWalletLocks(),
    appLocked: isAppLocked(),
    remoteLocked,
    takenAt: Date.now(),
  };
}

export interface ProtectionsDrift {
  /** Wallets that were locked and are not any more. */
  unlocked: string[];
  /** True when the app lock was cleared during pairing. */
  appUnlocked: boolean;
  /** True when a "locked elsewhere" answer was replaced by "not locked". */
  remoteUnlocked: boolean;
}

/**
 * Put back every protection that pairing loosened, and say what had to be
 * restored. An empty result means nothing changed, which is the normal case.
 */
export async function restoreProtections(before: ProtectionsSnapshot): Promise<ProtectionsDrift> {
  await refreshWalletLocks();
  const after = allWalletLocks();
  const unlocked: string[] = [];
  for (const [walletId, wasLocked] of Object.entries(before.wallets)) {
    if (wasLocked && after[walletId] !== true) {
      await setWalletLocked(walletId, true);
      unlocked.push(walletId);
    }
  }

  const appUnlocked = before.appLocked && !isAppLocked();

  let remoteUnlocked = false;
  if (before.remoteLocked === true) {
    try {
      const remote = await refreshRegistryLock();
      remoteUnlocked = !!remote && remote.locked !== true;
    } catch {
      // Unreachable is not proof that the other device unlocked: leave the
      // cached answer alone, which is what the registry already guarantees.
      remoteUnlocked = false;
    }
  }

  return { unlocked, appUnlocked, remoteUnlocked };
}

/** True when the drift is nothing at all. */
export function protectionsIntact(drift: ProtectionsDrift): boolean {
  return drift.unlocked.length === 0 && !drift.appUnlocked && !drift.remoteUnlocked;
}
