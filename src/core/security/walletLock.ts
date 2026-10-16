/**
 * Veltravia Wallet — wallet lock (AI-initiated freeze), PER WALLET.
 *
 * Each wallet account carries its own lock flag: locking "Main" does not
 * freeze "Trading". While a wallet is locked the app looks completely
 * normal — balances, history and receiving all work — only VALUE MOVEMENT
 * for THAT wallet is frozen until the user unlocks it again.
 *
 * Storage: one keychain entry holding a JSON map walletId -> '1'/'0'
 * (a flag, never secret material). The synchronous getter lets the
 * deterministic transfer pipeline refuse without an await; refresh at
 * boot / chat open / wallets screen focus keeps it honest.
 */
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.veltravia.wallet.walletlock';

/** walletId -> locked. Cached so guards can be synchronous. */
let cache: Record<string, boolean> = {};

/** Load the persisted map and refresh the cache. Call at boot / focus. */
export async function refreshWalletLocks(): Promise<Record<string, boolean>> {
  try {
    const res = await Keychain.getGenericPassword({ service: SERVICE });
    if (res === false) {
      cache = {};
    } else {
      const parsed = JSON.parse(res.password);
      cache = typeof parsed === 'object' && parsed ? parsed : {};
    }
  } catch {
    /* keep whatever we already cached */
  }
  return { ...cache };
}

/** Back-compat single-wallet refresh: refreshes all, returns this wallet. */
export async function refreshWalletLock(walletId = 'default'): Promise<boolean> {
  await refreshWalletLocks();
  return walletLocked(walletId);
}

/** Synchronous guard used by the transfer pipeline. */
export function walletLocked(walletId = 'default'): boolean {
  return cache[walletId] === true;
}

/** Snapshot of every wallet's lock state (for the wallets list badges). */
export function allWalletLocks(): Record<string, boolean> {
  return { ...cache };
}

/** Persist + cache. Called ONLY after the user approved on the lock card. */
export async function setWalletLocked(walletId: string, locked: boolean): Promise<void> {
  cache = { ...cache, [walletId]: locked };
  await Keychain.setGenericPassword('locks', JSON.stringify(cache), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await refreshWalletLocks();
}
