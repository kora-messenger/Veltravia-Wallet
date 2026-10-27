/**
 * Veltravia Wallet — Perps account (separate from the main wallet balance).
 *
 * Like Trust, perps trading runs on its own funded account: money in your
 * regular wallet is NOT perps balance until you Deposit, and Withdraw moves it
 * back. The Perps home reads this store to choose its layout: empty -> the
 * "Deposit to fund your first position" hero; funded -> the balance header.
 *
 * One account per wallet (multi-instance rule), persisted in encrypted
 * storage. v1 holds the USDC balance only; deposits/withdrawals settle through
 * api.veltraviawallet.com once the Wallet Core signing bridge ships.
 *
 * The balance is held PER PROVIDER (Hyperliquid, Aster), like Trust: money
 * lives at one provider, so a withdrawal must be taken from the provider that
 * actually holds it. `available` stays the total across providers so the
 * Perps home keeps working unchanged.
 */
import { useSyncExternalStore } from 'react';
import { readSettings, writeSettings } from '../core/storage/secureStorage';

export type PerpsProviderId = 'hyperliquid' | 'aster';
export const PERPS_PROVIDERS: ReadonlyArray<{ id: PerpsProviderId; name: string }> = [
  { id: 'hyperliquid', name: 'Hyperliquid' },
  { id: 'aster', name: 'Aster' },
];
/** Deposits go to Hyperliquid unless a provider is chosen. */
export const DEFAULT_PROVIDER: PerpsProviderId = 'hyperliquid';

export interface PerpsAccount {
  /** Free collateral (USDC) per provider. */
  byProvider: Record<PerpsProviderId, number>;
  /** Total free collateral across providers (kept in sync; read by the Perps home). */
  available: number;
  /** Margin currently locked in open positions. */
  inPositions: number;
  /** Unrealized profit/loss on open positions. */
  unrealizedPnl: number;
}

const EMPTY: PerpsAccount = { byProvider: { hyperliquid: 0, aster: 0 }, available: 0, inPositions: 0, unrealizedPnl: 0 };
const KEY = 'perpsAccounts';

let accounts: Record<string, PerpsAccount> = {};
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function persist() {
  try {
    await writeSettings({ [KEY]: accounts });
  } catch {
    /* storage unavailable: balance stays in memory for this session */
  }
}

/** Load once at startup (idempotent). */
export async function loadPerpsAccounts(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const s = await readSettings();
    if (s[KEY] && typeof s[KEY] === 'object') {
      accounts = Object.fromEntries(
        Object.entries(s[KEY] as Record<string, PerpsAccount>).map(([id, a]) => [id, normalize(a)]),
      );
      emit();
    }
  } catch {
    /* start empty */
  }
}

export function getPerpsAccount(walletId: string): PerpsAccount {
  return accounts[walletId] ?? EMPTY;
}

/** Total account value shown in the header. */
export function accountValue(a: PerpsAccount): number {
  return a.available + a.inPositions + a.unrealizedPnl;
}

/** True once the perps account holds anything (balance or open margin). */
export function isFunded(a: PerpsAccount): boolean {
  return a.available > 0 || a.inPositions > 0;
}

/** Older saves had one pooled `available`; treat it as sitting at Hyperliquid. */
function normalize(a: PerpsAccount): PerpsAccount {
  if (a.byProvider) return { ...a, available: sumProviders(a.byProvider) };
  const pooled = Number((a as { available?: number }).available) || 0;
  return { ...a, byProvider: { hyperliquid: pooled, aster: 0 }, available: pooled };
}

const sumProviders = (b: Record<PerpsProviderId, number>) => round(b.hyperliquid + b.aster);

/** Free balance held at one provider. */
export function providerBalance(walletId: string, provider: PerpsProviderId): number {
  return getPerpsAccount(walletId).byProvider[provider];
}

function setProviderBalance(walletId: string, provider: PerpsProviderId, value: number) {
  const a = getPerpsAccount(walletId);
  const byProvider = { ...a.byProvider, [provider]: round(value) };
  accounts = { ...accounts, [walletId]: { ...a, byProvider, available: sumProviders(byProvider) } };
  emit();
  persist();
}

/** Move USDC from the main wallet into a provider's perps balance. */
export function depositToPerps(walletId: string, amount: number, provider: PerpsProviderId = DEFAULT_PROVIDER) {
  if (!(amount > 0)) return;
  setProviderBalance(walletId, provider, providerBalance(walletId, provider) + amount);
}

/**
 * Move free USDC from ONE provider back to the main wallet. Returns false if
 * the amount exceeds what that provider holds (money at another provider does
 * not count: the user must withdraw from the provider that has it).
 */
export function withdrawFromPerps(walletId: string, amount: number, provider: PerpsProviderId = DEFAULT_PROVIDER): boolean {
  const held = providerBalance(walletId, provider);
  if (!(amount > 0) || amount > held) return false;
  setProviderBalance(walletId, provider, held - amount);
  return true;
}

/** Test/reset helper. */
export function resetPerpsAccounts() {
  accounts = {};
  loaded = false;
  sessionLoaded = false;
  emit();
}

// --- fresh-open loading ------------------------------------------------------
// The balance "fetch" only runs once per fresh app open: the first time the
// Perps tab mounts, the screen shows Trust's skeleton while the balance is
// fetched; every later visit renders instantly from the cached account.
let sessionLoaded = false;

export function perpsSessionLoaded(): boolean {
  return sessionLoaded;
}

export async function ensurePerpsSessionLoad(): Promise<void> {
  if (sessionLoaded) return;
  await loadPerpsAccounts();
  // Simulated round-trip until the api.veltraviawallet.com feed is wired.
  await new Promise<void>((res) => { setTimeout(res, 800); });
  sessionLoaded = true;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function usePerpsAccount(walletId: string): PerpsAccount {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => getPerpsAccount(walletId),
  );
}
