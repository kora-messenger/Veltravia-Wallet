/**
 * Veltravia Wallet — trend chart logic (pure, unit-tested).
 *
 * The market page's normal view is a LINE/AREA trend chart (Trust 10:08
 * recording), not a candle chart:
 *   - at rest: green line, pale gradient area under it, a dot on the newest
 *     point, header = live price + 24h change
 *   - finger down: the area fill disappears, the line stays coloured up to the
 *     finger and turns grey after it, a haloed dot follows the finger, and the
 *     header shows THAT point's price, its change since the start of the
 *     range, and the point's date/time ("Oct 27, 2:30 PM")
 *   - release: snaps back to rest
 *
 * Ranges: 1H 1D 1W 1M 1Y YTD ALL (ALL is trend-only; the candle views keep
 * the six candle ranges).
 */
import { generateSeries, defaultInterval, type Interval, type Range } from './candleEngine';

export type TrendRange = Range | 'ALL';
export const TREND_RANGES: TrendRange[] = ['1H', '1D', '1W', '1M', '1Y', 'YTD', 'ALL'];

export interface TrendPoint { t: number; price: number }

/** Interval for a trend range. ALL walks four years of weekly points. */
export function trendInterval(range: TrendRange): Interval {
  return range === 'ALL' ? '1d' : defaultInterval(range);
}

const DAY = 86_400_000;
/** ALL = since the market's listing; we span 4 years of daily closes. */
export const ALL_SPAN_DAYS = 4 * 365;

/**
 * Close-price points, oldest -> newest, ending EXACTLY at the live price.
 * ALL is built from a 1Y daily walk stretched back with a calmer, longer
 * walk so the shape is a believable multi-year trend.
 */
export function trendSeries(seedKey: string, last: number, range: TrendRange, now: number): TrendPoint[] {
  if (range !== 'ALL') {
    const candles = generateSeries(seedKey, last, range, trendInterval(range), now);
    const pts = candles.map((c) => ({ t: c.t, price: c.close }));
    // the final point is the live price (the dot at the right edge)
    if (pts.length) pts[pts.length - 1] = { t: pts[pts.length - 1].t, price: last };
    return pts;
  }
  // ALL: 1Y of real daily candles, then older history by a damped walk back
  const year = generateSeries(seedKey, last, '1Y', '1d', now).map((c) => ({ t: c.t, price: c.close }));
  const oldest = year[0];
  const older: TrendPoint[] = [];
  let p = oldest.price;
  let s = 0;
  for (let i = 0; i < seedKey.length; i++) s = (Math.imul(s ^ seedKey.charCodeAt(i), 16777619)) >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let d = 1; d <= ALL_SPAN_DAYS - 365; d += 3) {
    p = Math.max(oldest.price * 0.05, p * (1 + (rnd() - 0.505) * 0.04));
    older.push({ t: oldest.t - d * DAY, price: p });
  }
  const pts = [...older.reverse(), ...year];
  pts[pts.length - 1] = { t: pts[pts.length - 1].t, price: last };
  return pts;
}

/** The point under a finger at x within [0,width]. */
export function pointIndexAtX(x: number, width: number, count: number): number {
  if (count <= 1 || width <= 0) return 0;
  const clamped = Math.max(0, Math.min(width, x));
  return Math.max(0, Math.min(count - 1, Math.round((clamped / width) * (count - 1))));
}

export interface TrendScrub {
  index: number;
  price: number;
  t: number;
  /** change since the first point of the range, in dollars and percent */
  delta: number;
  pct: number;
}

export function scrubAt(points: TrendPoint[], index: number): TrendScrub {
  const i = Math.max(0, Math.min(points.length - 1, index));
  const first = points[0].price;
  const price = points[i].price;
  const delta = price - first;
  return { index: i, price, t: points[i].t, delta, pct: first ? (delta / first) * 100 : 0 };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 27, 2:30 PM" in the device's local time (Trust shows local). */
export function formatScrubStamp(t: number, range: TrendRange): string {
  const d = new Date(t);
  const h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const time = `${h12}:${String(m).padStart(2, '0')} ${ap}`;
  const day = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  // multi-year views carry the year and drop the time-of-day
  if (range === 'ALL' || range === '1Y' || range === 'YTD') {
    return `${day}, ${d.getFullYear()}`;
  }
  return `${day}, ${time}`;
}

/** "+$1,579.0 (1.98%)" / "-$185.0 (0.23%)" — the header change line. */
export function formatScrubChange(delta: number, pct: number): string {
  const sign = delta >= 0 ? '+' : '-';
  const abs = Math.abs(delta);
  const body = abs >= 1000 ? abs.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : abs >= 1 ? abs.toFixed(1) : abs.toFixed(4);
  return `${sign}$${body} (${Math.abs(pct).toFixed(2)}%)`;
}
