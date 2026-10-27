/**
 * Veltravia Wallet — Perps withdraw logic (pure, no UI).
 *
 * Trust's Withdraw sheet: a keypad-driven amount, a percent slider over the
 * selected PROVIDER's balance, and a red "Not enough balance" the moment the
 * typed amount exceeds what that provider holds. Money at another provider
 * does not count: the user switches "Withdraw from" to the one that has it.
 */

/** Networks USDC can be received on (order follows Trust's list). */
export const WITHDRAW_NETWORKS = [
  { id: 'arbitrum', name: 'Arbitrum' },
  { id: 'ethereum', name: 'Ethereum' },
  { id: 'base', name: 'Base' },
  { id: 'optimism', name: 'Optimism' },
  { id: 'bnb', name: 'BNB Smart Chain' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'avalanche', name: 'Avalanche' },
  { id: 'solana', name: 'Solana' },
] as const;
export type WithdrawNetworkId = (typeof WITHDRAW_NETWORKS)[number]['id'];
export const DEFAULT_NETWORK: WithdrawNetworkId = 'arbitrum';

/** Slider stops: 0, 25, 50, 75, 100 %. */
export const PERCENT_STOPS = [0, 25, 50, 75, 100] as const;

const MAX_INT_DIGITS = 9;
const MAX_DECIMALS = 2;

/** Apply one keypad press ('0'-'9', '.', 'back') to the typed amount string. */
export function pressKey(current: string, key: string): string {
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  if (!/^[0-9]$/.test(key)) return current;
  if (current === '0') return key === '0' ? '0' : key; // no leading zeros
  const [int, dec] = current.split('.');
  if (dec !== undefined) return dec.length >= MAX_DECIMALS ? current : current + key;
  return int.length >= MAX_INT_DIGITS ? current : current + key;
}

export const parseAmount = (text: string): number => {
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
};

/** Amount string for a slider percentage of the provider balance (floored to cents). */
export function amountForPercent(balance: number, percent: number): string {
  if (!(balance > 0) || percent <= 0) return '';
  const v = Math.floor(((balance * percent) / 100) * 100) / 100;
  if (v <= 0) return '';
  return Number.isInteger(v) ? String(v) : String(v);
}

/** Slider position (0-100) implied by the typed amount. */
export function percentForAmount(balance: number, amount: number): number {
  if (!(balance > 0) || !(amount > 0)) return 0;
  return Math.min(100, Math.round((amount / balance) * 100));
}

export type WithdrawState = 'empty' | 'insufficient' | 'ready';

/**
 * 'insufficient' as soon as the typed amount is over this provider's balance
 * (including a provider holding nothing: any digit trips it).
 */
export function withdrawState(balance: number, amount: number): WithdrawState {
  if (!(amount > 0)) return 'empty';
  return amount > balance ? 'insufficient' : 'ready';
}

/** Which providers hold money, so the picker can show them. */
export const hasFunds = (balance: number) => balance > 0;
