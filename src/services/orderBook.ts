/**
 * Order book engine (Trust recording, Oct 28 2026).
 *
 * The ticket's list icon swaps the chart for a 19-row depth ladder:
 *
 *      Bid (size)   Price   |   Price   Ask (size)
 *
 * Bid prices run DOWN from the best bid, ask prices run UP from the best ask;
 * Trust draws them as a funnel with the best prices in the middle, so the
 * visual rows list the FAR levels first (top) and the touch last (bottom).
 * Bars are scaled to the largest size on screen. A footer ratio bar shows the
 * buy vs sell share of the visible depth ("B 34%  ...  66% S").
 *
 * Data is synthetic and deterministic per (market, tick) until the backend
 * order-book feed is wired; the SHAPE of the API is the same as a live feed.
 */

export const BOOK_ROWS = 19;
export const GROUP_OPTIONS = [1, 2, 5, 10, 100] as const;
export type BookGroup = (typeof GROUP_OPTIONS)[number];
export type BookCurrency = 'USD' | 'BTC';

export interface BookLevel { price: number; size: number } // size in base-asset units
export interface OrderBook { bids: BookLevel[]; asks: BookLevel[] }

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Round a price DOWN (bids) or UP (asks) to the grouping step. */
export const snapToGroup = (price: number, group: number, dir: 'down' | 'up') =>
  dir === 'down' ? Math.floor(price / group) * group : Math.ceil(price / group) * group;

/**
 * Build one frame of the book around `mid`. `tick` advances the synthetic feed
 * (the recording refreshes sizes about once a second).
 */
export function buildOrderBook(seedKey: string, mid: number, group: BookGroup, tick: number, rows = BOOK_ROWS): OrderBook {
  const rnd = rng(hash(`${seedKey}:${group}:${tick}`));
  // tick size of the underlying market, then grouped
  const base = mid >= 1000 ? 1 : mid >= 100 ? 0.1 : mid >= 1 ? 0.01 : 0.0001;
  const step = Math.max(base, group >= base ? group : base);
  const bestBid = snapToGroup(mid - base / 2, step, 'down');
  const bestAsk = Math.max(snapToGroup(mid + base / 2, step, 'up'), bestBid + step);
  const bids: BookLevel[] = [];
  const asks: BookLevel[] = [];
  for (let i = 0; i < rows; i++) {
    // deeper levels hold more size on average, with heavy-tailed randomness
    const depthBias = 0.35 + (i / rows) * 1.1;
    const sz = (r: number) => Math.max(0.0001, Math.round(depthBias * (0.2 + r * r * 5) * 1e4) / 1e4);
    bids.push({ price: round(bestBid - i * step, step), size: sz(rnd()) });
    asks.push({ price: round(bestAsk + i * step, step), size: sz(rnd()) });
  }
  return { bids, asks };
}
const round = (p: number, step: number) => {
  const d = step >= 1 ? 0 : Math.min(8, Math.ceil(-Math.log10(step)));
  return Number(p.toFixed(d));
};

/** Size shown in the chosen currency. USD = size x price, BTC = base units. */
export const levelSize = (l: BookLevel, cur: BookCurrency) => (cur === 'USD' ? l.size * l.price : l.size);

/** "307,192" for USD; "3.0719" style for base units. */
export function formatBookSize(v: number, cur: BookCurrency): string {
  if (cur === 'USD') return Math.round(v).toLocaleString('en-US');
  if (v >= 100) return v.toFixed(1);
  if (v >= 1) return v.toFixed(3);
  return v.toFixed(4);
}

export function formatBookPrice(p: number, group: number): string {
  const d = group >= 1 ? 0 : Math.min(8, Math.ceil(-Math.log10(group)));
  return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Rows in screen order: far levels at the top, the touch at the bottom. */
export function ladderRows(book: OrderBook, cur: BookCurrency) {
  const n = Math.min(book.bids.length, book.asks.length);
  const out: { bid: BookLevel; ask: BookLevel; bidV: number; askV: number }[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const bid = book.bids[k];
    const ask = book.asks[k];
    out.push({ bid, ask, bidV: levelSize(bid, cur), askV: levelSize(ask, cur) });
  }
  return out;
}

/** Bar widths as a 0-1 fraction of its half, scaled to the largest size on screen. */
export function barFractions(rows: { bidV: number; askV: number }[]) {
  const max = Math.max(1e-9, ...rows.map((r) => Math.max(r.bidV, r.askV)));
  return rows.map((r) => ({ bid: r.bidV / max, ask: r.askV / max }));
}

/** Buy vs sell share of the visible depth, in whole percent (sums to 100). */
export function buySellRatio(book: OrderBook, cur: BookCurrency = 'USD') {
  const b = book.bids.reduce((s, l) => s + levelSize(l, cur), 0);
  const a = book.asks.reduce((s, l) => s + levelSize(l, cur), 0);
  const tot = b + a;
  if (!(tot > 0)) return { buy: 50, sell: 50 };
  const buy = Math.round((b / tot) * 100);
  return { buy, sell: 100 - buy };
}

export interface BookSettings { currency: BookCurrency; group: BookGroup }
export const DEFAULT_BOOK_SETTINGS: BookSettings = { currency: 'USD', group: 1 };
export const isDefaultBookSettings = (s: BookSettings) =>
  s.currency === DEFAULT_BOOK_SETTINGS.currency && s.group === DEFAULT_BOOK_SETTINGS.group;

/** Group options that make sense for a market (no 100-step on a $2 asset). */
export function groupOptionsFor(mid: number): BookGroup[] {
  if (mid >= 1000) return [...GROUP_OPTIONS];
  if (mid >= 100) return [1, 2, 5, 10] as BookGroup[];
  return [1, 2, 5] as BookGroup[];
}
