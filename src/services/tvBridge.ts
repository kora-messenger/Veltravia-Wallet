/**
 * Veltravia Wallet — TradingView WebView bridge (pure logic, unit-tested).
 *
 * Implements the host page's protocol (page version 18, extracted from
 * Trust's APK) without touching React or the WebView itself, so the whole
 * handshake can be exercised in jest:
 *
 *   web -> RN   ready {pageVersion} / barsRequest {id, symbol, resolution,
 *               from, to, countBack} / dataState {empty} / gesture / error
 *   RN -> web   init {symbol, description, exchange, interval, theme,
 *               pricescale, showVolume, colors}
 *               barsResponse {id, bars, meta:{noData}}
 *               setResolution / setChartType / theme / updateTick
 */
import { generateSeries, type Interval } from './candleEngine';

export const TV_RESOLUTIONS = ['1', '5', '15', '30', '60', '240', '1D', '1W'] as const;
export type TvResolution = typeof TV_RESOLUTIONS[number];

export const intervalToResolution: Record<Interval, TvResolution> = {
  '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': '1D',
};

export function resolutionToInterval(r: TvResolution): Interval {
  switch (r) {
    case '1': return '1m';
    case '5': return '5m';
    case '15': return '15m';
    case '30': return '30m';
    case '60': return '1h';
    case '240': return '4h';
    default: return '1d';
  }
}

/** The axis price scale: 100 = 2 decimals; small coins need finer scales. */
export function inferPricescale(price: number): number {
  if (price >= 1) return 100;
  if (price >= 0.01) return 10000;
  return 1000000;
}

export interface TvBar { time: number; open: number; high: number; low: number; close: number; volume: number }
export interface TvColors {
  backgroundPrimary: string;
  brandPrimary: string;
  successMain: string;
  errorMain: string;
  textSecondary: string;
  axisText: string;
}

export interface TvMarket {
  symbol: string;
  description: string;
  exchange: string;
  last: number;
  pricescale?: number;
  theme: 'dark' | 'light';
  resolution: TvResolution;
  chartType: 'candle' | 'line';
  showVolume: boolean;
  colors: TvColors;
}

/** The init payload the page's create() expects. */
export function initPayload(m: TvMarket) {
  return {
    symbol: m.symbol,
    description: m.description,
    exchange: m.exchange,
    interval: m.resolution,
    theme: m.theme,
    pricescale: m.pricescale ?? inferPricescale(m.last),
    showVolume: m.showVolume,
    colors: m.colors,
  };
}

export interface BarsRequest {
  id: string;
  symbol: string;
  resolution: TvResolution;
  from: number;
  to: number;
  countBack?: number;
  firstRequest?: boolean;
}

/**
 * One series per interval, frozen clock, so every history page the library
 * requests is a slice of the SAME walk — panning back never rewrites the
 * chart. Bars are unix SECONDS (TradingView), not ms.
 */
export function makeBarSource(seedKey: string, last: number, clock: number) {
  const cache = new Map<Interval, TvBar[]>();
  const series = (interval: Interval): TvBar[] => {
    let bars = cache.get(interval);
    if (!bars) {
      bars = generateSeries(seedKey, last, '1Y', interval, clock).map((c) => ({
        time: Math.floor(c.t / 1000), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
      }));
      cache.set(interval, bars);
    }
    return bars;
  };
  return (req: BarsRequest) => {
    const all = series(resolutionToInterval(req.resolution));
    const bars = all.filter((b) => b.time >= req.from && b.time <= req.to);
    const window = req.countBack && req.countBack > 0 && bars.length > req.countBack
      ? bars.slice(-req.countBack) : bars;
    // noData marks the END of history: requested window predates bar zero
    const noData = bars.length === 0 || req.from < all[0].time - 1;
    return { id: req.id, bars: window, meta: { noData } };
  };
}

export interface BridgeDeps {
  post: (type: string, payload: object) => void;
  getBars: (req: BarsRequest) => { id: string; bars: TvBar[]; meta: { noData: boolean } };
  market: () => TvMarket;
  onEmptyChange?: (empty: boolean) => void;
  onGesture?: (active: boolean) => void;
  onReady?: (pageVersion: number) => void;
  onError?: (where: string, message: string) => void;
}

/**
 * Handles one JSON message from the WebView. Returns the raw payload for
 * 'ready' so the component can flag its side of the handshake.
 */
export function handleWebMessage(raw: string, d: BridgeDeps): { type: 'ready' } | null {
  let msg: { type?: string; payload?: any };
  try { msg = JSON.parse(raw); } catch { return null; }
  if (!msg || typeof msg.type !== 'string') return null;
  switch (msg.type) {
    case 'ready':
      d.post('init', initPayload(d.market()));
      d.onReady?.(msg.payload?.pageVersion ?? 0);
      return { type: 'ready' };
    case 'barsRequest': {
      const req = msg.payload as BarsRequest;
      if (!req || typeof req.id === 'undefined') return null;
      d.post('barsResponse', d.getBars(req));
      return null;
    }
    case 'dataState':
      d.onEmptyChange?.(!!msg.payload?.empty);
      return null;
    case 'gesture':
      d.onGesture?.(!!msg.payload?.active);
      return null;
    case 'error':
      d.onError?.(msg.payload?.where ?? '?', msg.payload?.message ?? '');
      return null;
    default:
      return null;
  }
}
