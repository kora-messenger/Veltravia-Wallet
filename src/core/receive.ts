/**
 * Veltravia Wallet — receive addresses.
 *
 * The single seam between the Receive UI and key derivation. Today it returns
 * a deterministic PLACEHOLDER address per (wallet, network) so the screen,
 * QR and copy flow are real and testable. When the Wallet Core bridge lands,
 * replace `getReceiveAddress` with `walletManager.deriveAccounts()` (EVM
 * chains share one address; each Receive should rotate to a fresh HD index
 * per the privacy policy). Nothing else in the UI needs to change.
 */

import { CHAINS } from '../config/chains';

export interface ReceiveNetwork {
  id: string;
  name: string;
  symbol: string;
  /** Address family: EVM networks share the same 0x address. */
  family: 'evm';
}

export const RECEIVE_NETWORKS: ReceiveNetwork[] = CHAINS.map((c) => ({
  id: c.id,
  name: c.name,
  symbol: c.symbol,
  family: 'evm' as const,
}));

/** FNV-1a -> 40 hex chars, stable per seed. Placeholder only. */
function pseudoAddress(seed: string): string {
  let out = '';
  let h = 0x811c9dc5;
  for (let round = 0; out.length < 40; round++) {
    const s = `${seed}:${round}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
  }
  return out.slice(0, 40);
}

/** EIP-55 style mixed-case so it looks like a real checksummed address. */
function checksumCase(hex: string): string {
  let h = 0x811c9dc5;
  let out = '';
  for (let i = 0; i < hex.length; i++) {
    h ^= hex.charCodeAt(i) + i;
    h = Math.imul(h, 0x01000193) >>> 0;
    const ch = hex[i];
    out += /[a-f]/.test(ch) && (h & 8) ? ch.toUpperCase() : ch;
  }
  return out;
}

/**
 * Simulated async derive: the real one reads the encrypted seed and runs
 * Wallet Core, which is not instant. Keeping it async means the skeleton
 * state is a real loading state, not a fake timer in the view.
 */
export async function getReceiveAddress(walletId: string, _network: ReceiveNetwork): Promise<string> {
  await new Promise<void>((r) => setTimeout(r, 900));
  return `0x${checksumCase(pseudoAddress(`veltravia:${walletId}`))}`;
}
