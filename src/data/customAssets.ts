/**
 * Veltravia Wallet — custom token / network validation + storage helpers.
 * Pure functions so they are unit-tested; persistence uses the encrypted
 * settings store. Nothing here talks to a third party (privacy-first):
 * on-chain metadata lookup will go through api.veltraviawallet.com.
 */
export interface CustomToken {
  network: string;      // Network.id
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}
export interface CustomNetwork {
  id: string;           // generated, "custom-<n>"
  name: string;
  symbol: string;
  nodeUrl: string;
  explorerUrl?: string;
  chainlist?: string;
}

/** EVM address: 0x + 40 hex chars. */
export const isEvmAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v.trim());

/** http(s) URL with a host. */
export function isHttpUrl(v: string): boolean {
  const t = v.trim();
  if (!/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(t)) return false;
  return /^https?:\/\/[^/]+\.[^/]+/i.test(t) || /^https?:\/\/localhost/i.test(t);
}

export interface TokenFormErrors { address?: string; name?: string; symbol?: string; decimals?: string }
export function validateToken(f: { address: string; name: string; symbol: string; decimals: string }, evm: boolean): TokenFormErrors {
  const e: TokenFormErrors = {};
  if (!f.address.trim()) e.address = 'Enter the contract address';
  else if (evm && !isEvmAddress(f.address)) e.address = 'Not a valid contract address';
  if (!f.name.trim()) e.name = 'Enter the token name';
  if (!f.symbol.trim()) e.symbol = 'Enter the token symbol';
  else if (f.symbol.trim().length > 11) e.symbol = 'Symbol is too long';
  if (f.decimals.trim() === '') e.decimals = 'Enter the decimals';
  else if (!/^\d+$/.test(f.decimals.trim()) || Number(f.decimals) > 36) e.decimals = 'Decimals must be 0 to 36';
  return e;
}

export interface NetworkFormErrors { name?: string; symbol?: string; nodeUrl?: string; explorerUrl?: string }
export function validateNetwork(f: { name: string; symbol: string; nodeUrl: string; explorerUrl: string }): NetworkFormErrors {
  const e: NetworkFormErrors = {};
  if (!f.name.trim()) e.name = 'Enter the network name';
  if (!f.symbol.trim()) e.symbol = 'Enter the currency symbol';
  if (!f.nodeUrl.trim()) e.nodeUrl = 'Enter the node URL';
  else if (!isHttpUrl(f.nodeUrl)) e.nodeUrl = 'Enter a valid URL starting with https://';
  if (f.explorerUrl.trim() && !isHttpUrl(f.explorerUrl)) e.explorerUrl = 'Enter a valid URL starting with https://';
  return e;
}

export const hasErrors = (e: object) => Object.keys(e).length > 0;
