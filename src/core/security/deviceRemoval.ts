/**
 * Veltravia Wallet — "this device was unlinked".
 *
 * When an owner removes a device from the wallet group, that device must stop
 * being a wallet: no phrase, no accounts, no lock flags, no cached group. It
 * returns to the welcome screen, exactly as if the app had just been installed.
 *
 * WHAT THIS IS: a cooperative wipe. The device learns it was removed when it
 * reads state it can no longer decrypt (see lockRegistry), then deletes its own
 * copy of everything and resets. That is the behaviour a normal install has, and
 * it is the behaviour a user expects when they press "Remove".
 *
 * WHAT THIS IS NOT: remote erasure. Nobody can force a modified build or an
 * offline phone to forget a phrase it already stored — no wallet, custodial or
 * not, can do that without the keys living on a server. The security that does
 * hold is the key rotation (see walletGroup.revokeDevice): a removed device
 * cannot read the group's future lock state, and cannot re-derive the rotated
 * key from the phrase.
 *
 * Non-custodial is untouched by any of this: the phrase never leaves the
 * device, the server only ever holds ciphertext, and unlinking deletes local
 * material rather than asking a server to forget it.
 */
import * as Keychain from 'react-native-keychain';
import { wipeWallet } from '../storage/secureStorage';
import { clearGroup } from './walletGroup';
import { resetLockRegistry } from './lockRegistry';
import { emitDeviceRemoved } from './removalEvents';

/**
 * Keychain services this app owns. A removed device clears all of them, so no
 * partial state (accounts list, lock flags, cached blob, AI memory) survives.
 */
const FIXED_SERVICES = [
  'com.veltravia.wallet.accounts',
  'com.veltravia.wallet.walletlock',
  'com.veltravia.wallet.lockregistry',
  'com.veltravia.wallet.walletgroup',
  'com.veltravia.wallet.deviceid',
  'com.veltravia.wallet.devicekey',
  'com.veltravia.wallet.passcode',
  'com.veltravia.wallet.aimem',
  'com.veltravia.wallet',
];

/** Account-scoped services need the wallet ids, read before the list disappears. */
async function accountScopedServices(): Promise<string[]> {
  try {
    const res = await Keychain.getGenericPassword({ service: 'com.veltravia.wallet.accounts' });
    if (res === false) return [];
    const parsed = JSON.parse(res.password);
    const ids: string[] = Array.isArray(parsed)
      ? parsed.map((w: any) => String(w?.id ?? '')).filter(Boolean)
      : [];
    return ids.map((id) => `com.veltravia.wallet.securitypassword.${id}`);
  } catch {
    return [];
  }
}

/**
 * Delete this device's wallet and leave it at a clean install state.
 * Safe to call more than once.
 */
export async function wipeRemovedDevice(): Promise<void> {
  const scoped = await accountScopedServices();
  await wipeWallet().catch(() => {});
  // Clear in-memory caches first: their setters would otherwise re-create the
  // keychain entries the loop below deletes.
  await clearGroup().catch(() => {});
  await resetLockRegistry().catch(() => {});
  for (const service of [...FIXED_SERVICES, ...scoped]) {
    await Keychain.resetGenericPassword({ service }).catch(() => {});
  }
}

/** True while an unlink has been carried out and the notice has not been shown. */
let noticePending = false;

export function takeRemovalNotice(): boolean {
  const pending = noticePending;
  noticePending = false;
  return pending;
}

/** Tests only. */
export function __setRemovalNoticeForTests(value: boolean): void {
  noticePending = value;
}

/**
 * React to a removal: wipe, flag the notice for the welcome screen, and tell
 * the app root to navigate back.
 */
export async function handleDeviceRemoved(): Promise<void> {
  await wipeRemovedDevice();
  noticePending = true;
  emitDeviceRemoved();
}
