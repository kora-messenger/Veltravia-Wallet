/**
 * Perps trade ticket logic (pure, no React). Modeled on the Trust recording
 * (Open Long / Open Short sheet over the market chart).
 *
 *  - three sheet snap points: peek (just the header row), half (default,
 *    chart still visible above), full (covers the screen, adds the
 *    "Liquidation price" row)
 *  - amount is the user's margin ("$0"); Size = amount x leverage
 *  - the slider has 5 stops (0 / 25 / 50 / 75 / 100 %) of the available
 *    perps balance
 *  - the primary button is "Fund wallet" while the venue balance is $0,
 *    otherwise "Open Long" / "Open Short"
 */

export type TradeSide = 'long' | 'short';
export type SheetSnap = 'peek' | 'half' | 'full';

export const SLIDER_STOPS = [0, 25, 50, 75, 100] as const;
export const TRADE_FEE_PCT = 0.15;
export const DEFAULT_LEVERAGE = 3;

export const sideTitle = (side: TradeSide) => (side === 'long' ? 'Open Long' : 'Open Short');

/** Sheet height (dp) for each snap, given the screen height. */
export function snapHeights(screenH: number, topInset: number) {
  return {
    peek: 84,
    half: Math.round(screenH * 0.52),
    full: Math.round(screenH - topInset - 8),
  } as const;
}

/** Nearest snap after a drag release: velocity (px/ms, +down) breaks ties. */
export function settleSnap(currentH: number, velocityY: number, heights: { peek: number; half: number; full: number }): SheetSnap {
  const projected = currentH - velocityY * 180; // a fling carries ~180ms further
  const order: SheetSnap[] = ['peek', 'half', 'full'];
  let best: SheetSnap = 'half';
  let bestD = Infinity;
  for (const s of order) {
    const d = Math.abs(heights[s] - projected);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Slider position (0-100) -> margin in USD, snapped to a stop when close. */
export function amountFromPercent(pct: number, balance: number): number {
  const p = Math.max(0, Math.min(100, pct));
  const snapped = SLIDER_STOPS.find((s) => Math.abs(s - p) <= 2) ?? p;
  return Math.floor(((balance * snapped) / 100) * 100) / 100;
}

export function percentFromAmount(amount: number, balance: number): number {
  if (balance <= 0) return 0;
  return Math.max(0, Math.min(100, (amount / balance) * 100));
}

/** Notional position size = margin x leverage. */
export const positionSize = (amount: number, leverage: number) =>
  Math.round(amount * leverage * 100) / 100;

export const feeFor = (size: number) => Math.round(size * (TRADE_FEE_PCT / 100) * 10000) / 10000;

/**
 * Approximate liquidation price for an isolated-style estimate:
 * long : entry * (1 - 1/lev + mmr)    short: entry * (1 + 1/lev - mmr)
 * (mmr = 0.5% maintenance margin). Returns null until an amount is entered.
 */
export function liquidationPrice(entry: number, leverage: number, side: TradeSide, amount: number): number | null {
  if (!(amount > 0) || !(entry > 0) || !(leverage > 0)) return null;
  const mmr = 0.005;
  const p = side === 'long' ? entry * (1 - 1 / leverage + mmr) : entry * (1 + 1 / leverage - mmr);
  return Math.max(0, p);
}

export type CtaState = { label: string; action: 'fund' | 'open' | 'disabled' };

/** "Fund wallet" while the perps balance is empty (the recording's state). */
export function ctaFor(side: TradeSide, balance: number, amount: number): CtaState {
  if (!(balance > 0)) return { label: 'Fund wallet', action: 'fund' };
  if (!(amount > 0)) return { label: sideTitle(side), action: 'disabled' };
  if (amount > balance) return { label: 'Insufficient balance', action: 'disabled' };
  return { label: sideTitle(side), action: 'open' };
}

/** "$1,234.5" style, matching the screen's other money text. */
export function formatUsd(n: number): string {
  if (!isFinite(n)) return '$0';
  const [i, d] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}$${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${d === '00' ? '' : '.' + d}`;
}
export const formatSize = (n: number) => `$${n.toFixed(2)}`;

/** Fiat currencies listed under "Fund wallet with" (Trust's Pay-with screen). */
export const FUND_CURRENCIES = [
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
] as const;

/** OHLC header shown while a candle is held on the chart. */
export interface OhlcBar { t: number; o: number; h: number; l: number; c: number }
export function ohlcHeader(bar: OhlcBar) {
  const chg = bar.c - bar.o;
  const pct = bar.o ? (chg / bar.o) * 100 : 0;
  return {
    open: bar.o, high: bar.h, low: bar.l, close: bar.c,
    delta: chg, deltaPct: pct, up: chg >= 0,
  };
}
export function formatOhlcDelta(h: { delta: number; deltaPct: number }): string {
  const s = h.delta >= 0 ? '+' : '-';
  const abs = Math.abs(h.delta);
  return `${s}$${abs.toFixed(1)} (${Math.abs(h.deltaPct).toFixed(2)}%)`;
}
