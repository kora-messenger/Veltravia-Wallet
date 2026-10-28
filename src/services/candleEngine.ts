/**
 * Veltravia Wallet — candle chart engine (pure logic).
 *
 * Series generation, the visible window (pan / zoom), the auto-fit price
 * scale, and the axis tick maths. The view (CandleChart) only draws what
 * these functions return, so every behaviour here is unit-tested.
 *
 * Until api.veltraviawallet.com serves real OHLC, candles are deterministic
 * per (market, interval): same inputs always give the same chart, and the
 * final close always equals the market's live price.
 */

export interface Candle {
  /** unix ms of the candle open */
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Interval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
export const INTERVALS: Interval[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

export const INTERVAL_MS: Record<Interval, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
  '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
};

/** Range chips -> how far back to look, and the default candle interval. */
export type Range = '1H' | '1D' | '1W' | '1M' | '1Y' | 'YTD';
export const RANGES: Range[] = ['1H', '1D', '1W', '1M', '1Y', 'YTD'];

const RANGE_MS: Record<Exclude<Range, 'YTD'>, number> = {
  '1H': 3_600_000, '1D': 86_400_000, '1W': 7 * 86_400_000,
  '1M': 30 * 86_400_000, '1Y': 365 * 86_400_000,
};

export function rangeSpanMs(range: Range, now: number): number {
  if (range !== 'YTD') return RANGE_MS[range];
  const d = new Date(now);
  return now - Date.UTC(d.getUTCFullYear(), 0, 1);
}

/** Trust opens each range on a sensible interval; the user can change it. */
export function defaultInterval(range: Range): Interval {
  switch (range) {
    case '1H': return '1m';
    case '1D': return '30m';
    case '1W': return '4h';
    case '1M': return '4h';
    case '1Y': return '1d';
    default: return '1d';
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Maximum candles ever generated (keeps 1m over 1Y from exploding). */
export const MAX_CANDLES = 600;

export function generateSeries(
  seedKey: string, last: number, range: Range, interval: Interval, now: number,
): Candle[] {
  const step = INTERVAL_MS[interval];
  const span = rangeSpanMs(range, now);
  const n = Math.max(12, Math.min(MAX_CANDLES, Math.round(span / step)));
  const rnd = rng(hash(`${seedKey}:${range}:${interval}`));
  const vol = 0.0035 * Math.sqrt(step / 1_800_000 + 0.2); // bigger candles on bigger intervals
  const out: Candle[] = [];
  let close = last;
  const end = Math.floor(now / step) * step;
  for (let i = 0; i < n; i++) {
    const drift = (rnd() - 0.485) * vol * close * 3;
    const open = close + drift;
    const high = Math.max(open, close) * (1 + rnd() * vol * 0.9);
    const low = Math.min(open, close) * (1 - rnd() * vol * 0.9);
    const volume = (0.3 + rnd() * 0.7) * (1 + Math.abs(drift) / (close * vol * 3)) * 100;
    out.push({ t: end - i * step, open, high, low, close, volume });
    close = open;
  }
  return out.reverse();
}

/* ---- visible window (pan / zoom) ----------------------------------------- */

export interface Viewport {
  /** index (fractional) of the left-most visible candle */
  start: number;
  /** number of candles that fit across the plot */
  count: number;
}

export const MIN_VISIBLE = 8;

/** Opening view: the whole series, with a little air on the right. */
export function initialViewport(total: number): Viewport {
  const count = Math.min(Math.max(MIN_VISIBLE, total), 90);
  return { start: total - count + 2, count };
}

export function clampViewport(v: Viewport, total: number): Viewport {
  const count = Math.max(MIN_VISIBLE, Math.min(v.count, Math.max(MIN_VISIBLE, total + 10)));
  // allow scrolling a little past either end, like Trust (blank space)
  const minStart = -count * 0.5;
  const maxStart = total - count * 0.5;
  return { start: Math.max(minStart, Math.min(v.start, maxStart)), count };
}

/** Pan by a pixel delta (positive dx drags the chart right = older candles). */
export function panViewport(v: Viewport, dxPx: number, plotWidth: number, total: number): Viewport {
  const perPx = v.count / plotWidth;
  return clampViewport({ start: v.start - dxPx * perPx, count: v.count }, total);
}

/**
 * Pinch zoom around a focal x. `scale` > 1 zooms in (fewer candles).
 * The candle under the focal point stays put.
 */
export function zoomViewport(
  v: Viewport, scale: number, focalPx: number, plotWidth: number, total: number,
): Viewport {
  const s = Math.max(0.2, Math.min(5, scale));
  const nextCount = v.count / s;
  const focalFrac = focalPx / plotWidth;
  const focalIndex = v.start + focalFrac * v.count;
  return clampViewport({ start: focalIndex - focalFrac * nextCount, count: nextCount }, total);
}

export function visibleSlice(candles: Candle[], v: Viewport): { first: number; items: Candle[] } {
  const first = Math.max(0, Math.floor(v.start));
  const last = Math.min(candles.length, Math.ceil(v.start + v.count));
  return { first, items: candles.slice(first, last) };
}

/* ---- price scale (auto-fit to what is on screen) ------------------------- */

export interface PriceScale { min: number; max: number }

export function fitPriceScale(items: Candle[], fallback: number): PriceScale {
  if (items.length === 0) return { min: fallback * 0.99, max: fallback * 1.01 };
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of items) { if (c.low < lo) lo = c.low; if (c.high > hi) hi = c.high; }
  const pad = (hi - lo) * 0.1 || hi * 0.002;
  return { min: lo - pad, max: hi + pad };
}

/** "Nice" tick values (1 / 2 / 2.5 / 5 x 10^n) across [min, max]. */
export function niceTicks(min: number, max: number, target = 8): number[] {
  const range = max - min;
  if (!(range > 0)) return [min];
  const raw = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const frac = raw / pow;
  const step = (frac < 1.5 ? 1 : frac < 2.25 ? 2 : frac < 3.5 ? 2.5 : frac < 7.5 ? 5 : 10) * pow;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(8)));
  return ticks;
}

export function formatAxisPrice(v: number, step: number): string {
  // decimals follow the tick step: 200 -> 2, 0.5 -> 2, 0.001 -> 4, 0.00001 -> 6
  const dp = step >= 0.1 ? 2 : step >= 0.0005 ? 4 : 6;
  return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/* ---- time axis ------------------------------------------------------------ */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Trust shows "12:00 / 18:00 / 28 / 06:00": day number at midnight, HH:mm otherwise. */
export function formatAxisTime(t: number, interval: Interval): string {
  const d = new Date(t);
  if (interval === '1d') return `${d.getUTCDate()}`;
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return `${d.getUTCDate()}`;
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** Indices of candles that get a time label, spaced so labels never collide. */
export function timeLabelIndices(items: Candle[], first: number, interval: Interval, approx = 4): number[] {
  if (items.length === 0) return [];
  const every = Math.max(1, Math.round(items.length / approx));
  const out: number[] = [];
  for (let i = every; i < items.length; i += every) out.push(first + i);
  return out;
}

/* ---- crosshair ------------------------------------------------------------ */

export function candleAtX(
  xPx: number, v: Viewport, plotWidth: number, total: number,
): number {
  // candle i is drawn centred at (i + 0.5): the candle under x is floor(position)
  const idx = Math.floor(v.start + (xPx / plotWidth) * v.count);
  return Math.max(0, Math.min(total - 1, idx));
}
