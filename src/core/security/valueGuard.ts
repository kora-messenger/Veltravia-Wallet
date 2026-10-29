/**
 * Veltravia Wallet — one place that answers "may value move right now?".
 *
 * A wallet can be blocked for two different reasons and they need different
 * words on screen:
 *
 *   locked-here      — locked ON THIS DEVICE, by this user, a minute ago.
 *                      Unlocking here fixes it.
 *   locked-elsewhere — the same wallet was locked on ANOTHER device (seen via
 *                      the lock registry after a recovery). This device cannot
 *                      lift it: the user has to go back to the older device.
 *
 * Every value path (send, swap, AI transfer, trade) asks `movementBlock()`
 * instead of reading the raw flags, so the wording can never drift.
 */
import { walletLocked } from './walletLock';
import { lockedElsewhere } from './lockRegistry';

export type MovementBlock =
  | { kind: 'locked-here' }
  | { kind: 'locked-elsewhere'; deviceName?: string }
  | null;

/** Synchronous: both flags are cached in memory by their stores. */
export function movementBlock(walletId = 'default'): MovementBlock {
  if (walletLocked(walletId)) return { kind: 'locked-here' };
  const elsewhere = lockedElsewhere();
  if (elsewhere) return { kind: 'locked-elsewhere', deviceName: elsewhere.deviceName };
  return null;
}

export function movementBlockTitle(block: MovementBlock): string {
  if (!block) return '';
  return block.kind === 'locked-elsewhere' ? 'Account locked' : 'Wallet locked';
}

/** The sentence the user sees, wherever they try to move value. */
export function movementBlockMessage(block: MovementBlock): string {
  if (!block) return '';
  if (block.kind === 'locked-elsewhere') {
    const where = block.deviceName ? ` (${block.deviceName})` : '';
    return `Account locked. Unlock your account on the older device where you locked it${where}.`;
  }
  return 'Your wallet is locked. Unlock it to send, swap or trade.';
}
