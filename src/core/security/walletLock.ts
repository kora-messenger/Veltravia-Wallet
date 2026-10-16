/**
 * Veltravia Wallet — wallet lock (AI-initiated freeze).
 *
 * When locked, the app looks completely normal: balances, history and
 * receiving all work. Only VALUE MOVEMENT is frozen — sends/swaps (and AI
 * transfer proposals) are refused with "wallet is locked" until the user
 * unlocks again through the same approval flow.
 *
 * Storage: a keychain flag (not the seed, never secret material).
 * The synchronous getter lets the deterministic transfer pipeline refuse
 * without an await; refresh at boot / chat open keeps it honest.
 */
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.veltravia.wallet.walletlock';

/** Cached state so guards can be synchronous. null until first refresh. */
let cached: boolean | null = null;

/** Read the persisted flag and refresh the cache. Call at boot / chat open. */
export async function refreshWalletLock(): Promise<boolean> {
  try {
    const res = await Keychain.getGenericPassword({ service: SERVICE });
    cached = res !== false && res.password === '1';
  } catch {
    cached = cached ?? false;
  }
  return cached;
}

/** Synchronous guard used by the transfer pipeline. */
export function walletLocked(): boolean {
  return cached === true;
}

/** Persist + cache. Called ONLY after the user approved on the lock card. */
export async function setWalletLocked(locked: boolean): Promise<void> {
  await Keychain.setGenericPassword('lock', locked ? '1' : '0', {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  cached = locked;
}
