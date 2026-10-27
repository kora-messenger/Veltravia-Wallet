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
 */
import { useSyncExternalStore } from 'react';
import { readSettings, writeSettings } from '../core/storage/secureStorage';

export interface PerpsAccount {
  /** Free collateral (USDC), available to open positions or withdraw. */
  available: number;
  /** Margin currently locked in open positions. */
  inPositions: number;
  /** Unrealized profit/loss on open positions. */
  unrealizedPnl: number;
}

const EMPTY: PerpsAccount = { available: 0, inPositions: 0, unrealizedPnl: 0 };
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
      accounts = s[KEY];
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

/** Move USDC from the main wallet into the perps account. */
export function depositToPerps(walletId: string, amount: number) {
  if (!(amount > 0)) return;
  const a = getPerpsAccount(walletId);
  accounts = { ...accounts, [walletId]: { ...a, available: round(a.available + amount) } };
  emit();
  persist();
}

/** Move free USDC back to the main wallet. Returns false if over the free balance. */
export function withdrawFromPerps(walletId: string, amount: number): boolean {
  const a = getPerpsAccount(walletId);
  if (!(amount > 0) || amount > a.available) return false;
  accounts = { ...accounts, [walletId]: { ...a, available: round(a.available - amount) } };
  emit();
  persist();
  return true;
}

/** Test/reset helper. */
export function resetPerpsAccounts() {
  accounts = {};
  loaded = false;
  emit();
}

const round = (n: number) => Math.round(n * 100) / 100;

export function usePerpsAccount(walletId: string): PerpsAccount {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => getPerpsAccount(walletId),
  );
}
