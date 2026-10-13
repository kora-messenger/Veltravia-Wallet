/**
 * Veltravia Wallet — portfolio history engine.
 *
 * Computes the TOTAL portfolio value over time (never a single coin's
 * price). At every point on the chart:
 *
 *     value(t) = Σ  amountOf(symbol, t) × priceOf(symbol, t)
 *
 * - `amountOf` applies transaction deltas backwards through time, so a
 *   receive/sell yesterday shows up as a step in the line.
 * - `priceOf` is per-asset history. Phase 2 swaps `fetchPriceHistory`
 *   for the backend's `/v1/history` endpoint; the combiner below is
 *   already correct for real data.
 *
 * Everything is deterministic (seeded), so the chart is stable across
 * renders and testable. No telemetry, no external calls yet.
 */

export type Range = '7D' | '30D' | '90D' | '1Y';

export const RANGES: Range[] = ['7D', '30D', '90D', '1Y'];

export const RANGE_DAYS: Record<Range, number> = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 };

export interface Holding {
  symbol: string;
  /** Token amount held NOW (float is fine for display; money math on-chain is bigint). */
  amount: number;
  /** Current USD price. */
  price: number;
  change24h: number;
}

export interface HoldingDelta {
  symbol: string;
  /** Signed change in amount at this time (+ receive, - send). */
  delta: number;
  /** Unix ms when the holding changed. */
  at: number;
}

export interface PortfolioPoint {
  t: number; // unix ms
  value: number; // USD total
}

export interface Series {
  points: PortfolioPoint[];
  /** Change across the whole range. */
  changePct: number;
  changeUsd: number;
  start: number;
  end: number;
  high: number;
  low: number;
}

/* ------------------------------------------------------------------ *
 * Data. MOCK until the backend serves /v1/balances and /v1/history.
 * The fiat figures match the Home mock assets exactly.
 * ------------------------------------------------------------------ */
export const MOCK_HOLDINGS: Holding[] = [
  { symbol: 'ETH', amount: 0.1217, price: 3452.17, change24h: 1.9 },
  { symbol: 'BNB', amount: 0.467, price: 562.41, change24h: 2.4 },
  { symbol: 'USDT', amount: 327.98, price: 1.0, change24h: 0.0 },
  { symbol: 'MATIC', amount: 128.97, price: 1.1495, change24h: 1.2 },
  { symbol: 'SOL', amount: 0.3617, price: 247.2, change24h: 3.6 },
];

/** Recent holding changes (mock, matches the Home transactions). */
const MOCK_DELTAS: HoldingDelta[] = [
  { symbol: 'ETH', delta: 0.05, at: Date.now() - 26 * 3600 * 1000 }, // yesterday 08:42-ish receive
  { symbol: 'USDT', delta: -100, at: Date.now() - 2 * 24 * 3600 * 1000 }, // sent 2 days ago
  { symbol: 'ETH', delta: 0.08, at: Date.now() - 2 * 24 * 3600 * 1000 - 4 * 3600 * 1000 }, // swap in
  { symbol: 'BNB', delta: -0.4, at: Date.now() - 9 * 24 * 3600 * 1000 },
  { symbol: 'SOL', delta: 0.15, at: Date.now() - 40 * 24 * 3600 * 1000 },
  { symbol: 'MATIC', delta: 60, at: Date.now() - 65 * 24 * 3600 * 1000 },
];

/* ------------------------------------------------------------------ *
 * Deterministic price history (mock).
 *
 * A seeded walk per symbol, anchored so the series ENDS at today's
 * price. Replace `priceHistory` with the backend call in Phase 2 —
 * keep the return shape and everything else keeps working.
 * ------------------------------------------------------------------ */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    // xorshift-ish, stable in [0,1)
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

/** Per-symbol price at each of `n` evenly spaced points ending now. */
export function priceHistory(symbol: string, endPrice: number, days: number, n: number): number[] {
  const rand = seeded(symbol);
  // Daily-ish volatility per asset class (stablecoins ≈ flat).
  const vol = symbol === 'USDT' ? 0.0004 : symbol === 'MATIC' ? 0.028 : symbol === 'SOL' ? 0.03 : 0.02;

  const stepDays = days / (n - 1);
  const out: number[] = new Array(n);
  // Walk forward from a start price, then rescale so the final value = endPrice.
  // Stablecoins start within a whisker of the peg; volatile assets spread wider.
  const spread = Math.min(vol * 20, 0.35);
  let p = endPrice * (1 + (rand() - 0.5) * 2 * spread);
  for (let i = 0; i < n; i++) {
    // small mean-reverting drift so it looks like a market, not a random walk
    const drift = (endPrice - p) * 0.02;
    p = p * (1 + (rand() - 0.5) * 2 * vol * Math.sqrt(stepDays)) + drift;
    out[i] = Math.max(p, endPrice * 0.2);
  }
  const scale = endPrice / out[n - 1];
  return out.map((v, i) => v * (1 + (scale - 1) * (i / (n - 1))));
}

/* ------------------------------------------------------------------ *
 * Holdings over time: apply deltas backwards from today.
 * ------------------------------------------------------------------ */
export function amountAt(symbol: string, holdings: Holding[], deltas: HoldingDelta[], t: number): number {
  let amount = holdings.find((h) => h.symbol === symbol)?.amount ?? 0;
  // Walking back: before a delta happened, the amount was amount - delta.
  for (const d of deltas) {
    if (d.symbol === symbol && t < d.at) {
      amount -= d.delta;
    }
  }
  return Math.max(amount, 0);
}

/* ------------------------------------------------------------------ *
 * Total portfolio series.
 * ------------------------------------------------------------------ */
export function portfolioSeries(range: Range): Series {
  const days = RANGE_DAYS[range];
  const n = Math.min(Math.max(Math.round(days * 2), 40), 160); // 2 points/day, capped
  const now = Date.now();

  // Price history per symbol across the range.
  const prices = new Map<string, number[]>();
  for (const h of MOCK_HOLDINGS) {
    prices.set(h.symbol, priceHistory(h.symbol, h.price, days, n));
  }

  const points: PortfolioPoint[] = [];
  for (let i = 0; i < n; i++) {
    const t = now - (days - (days / (n - 1)) * i) * 24 * 3600 * 1000;
    let value = 0;
    for (const h of MOCK_HOLDINGS) {
      const hist = prices.get(h.symbol)!;
      const amount = amountAt(h.symbol, MOCK_HOLDINGS, MOCK_DELTAS, t);
      value += amount * hist[i];
    }
    points.push({ t, value });
  }

  const start = points[0].value;
  const end = points[points.length - 1].value;
  let high = -Infinity;
  let low = Infinity;
  for (const p of points) {
    high = Math.max(high, p.value);
    low = Math.min(low, p.value);
  }
  return {
    points,
    start,
    end,
    high,
    low,
    changePct: ((end - start) / start) * 100,
    changeUsd: end - start,
  };
}

/** Total USD value right now. */
export function totalValue(holdings: Holding[] = MOCK_HOLDINGS): number {
  return holdings.reduce((a, h) => a + h.amount * h.price, 0);
}

/** 24h change of the whole portfolio (weighted by holding value). */
export function change24h(holdings: Holding[] = MOCK_HOLDINGS): number {
  const total = totalValue(holdings);
  if (total === 0) return 0;
  // value today vs value yesterday (amounts unchanged; prices moved)
  let yest = 0;
  for (const h of holdings) {
    yest += (h.amount * h.price) / (1 + h.change24h / 100);
  }
  return ((total - yest) / yest) * 100;
}

/** Per-asset change across a range, for the performers card. */
export function performers(range: Range): { symbol: string; changePct: number; contributionUsd: number }[] {
  const days = RANGE_DAYS[range];
  const n = Math.min(Math.max(Math.round(days * 2), 40), 160); // same sampling as portfolioSeries
  return MOCK_HOLDINGS
    .map((h) => {
      const hist = priceHistory(h.symbol, h.price, days, n);
      const startP = hist[0];
      const endP = hist[hist.length - 1];
      return {
        symbol: h.symbol,
        changePct: ((endP - startP) / startP) * 100,
        contributionUsd: h.amount * (endP - startP),
      };
    })
    .sort((a, b) => b.contributionUsd - a.contributionUsd);
}
