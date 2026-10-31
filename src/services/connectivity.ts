/**
 * Veltravia Wallet - "can we reach the network right now?" for the two
 * onboarding buttons. Creating or restoring an account needs the network (the
 * address derivation path and the account record live behind our backend), so
 * the flow refuses to start offline instead of failing halfway and leaving the
 * user with a passcode and no account.
 *
 * Never guesses: a hung native call resolves as unknown-online after a short
 * timeout so the button cannot stay spinning forever.
 */
import NetInfo from '@react-native-community/netinfo';

export type OfflineReason = 'offline' | 'unreachable';

export interface NetworkVerdict {
  online: boolean;
  reason?: OfflineReason;
}

const TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/** Read the OS network state. `online: true` when it cannot be determined. */
export async function checkOnline(timeoutMs: number = TIMEOUT_MS): Promise<NetworkVerdict> {
  try {
    const state = await withTimeout(NetInfo.fetch(), timeoutMs);
    if (!state) return { online: true };
    if (state.isConnected === false) return { online: false, reason: 'offline' };
    if (state.isInternetReachable === false) return { online: false, reason: 'unreachable' };
    return { online: true };
  } catch {
    // Unknown (timeout / module missing): do not block the user on a guess.
    return { online: true };
  }
}

export function offlineMessage(reason?: OfflineReason): string {
  return reason === 'unreachable'
    ? 'No internet reachable. Connect to a network to continue.'
    : 'You are offline. Connect to the internet to create or restore a wallet.';
}
