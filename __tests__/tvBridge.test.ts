import {
  handleWebMessage, initPayload, makeBarSource, inferPricescale,
  intervalToResolution, resolutionToInterval,
} from '../src/services/tvBridge';
import { generateSeries, INTERVAL_MS } from '../src/services/candleEngine';

const COLORS = {
  backgroundPrimary: '#0B0D17', brandPrimary: '#6C63FF', successMain: '#158444',
  errorMain: '#D63232', textSecondary: '#8A8EA3', axisText: '#8A8EA3',
};
const MARKET = () => ({
  symbol: 'VELTRAVIA:BTC', description: 'Bitcoin (BTC)', exchange: 'Hyperliquid',
  last: 81434, theme: 'dark' as const, resolution: '30' as const,
  chartType: 'candle' as const, showVolume: true, colors: COLORS,
});
const NOW = Date.UTC(2026, 9, 28, 8, 30);

function harness(market = MARKET) {
  const posted: { type: string; payload: any }[] = [];
  const h = {
    posted,
    market,
    getBars: makeBarSource('hyperliquid:BTC', 81434, NOW),
    post: (type: string, payload: object) => posted.push({ type, payload }),
  };
  return h;
}

describe('TradingView bridge: handshake', () => {
  it('READY triggers INIT with the full create() payload', () => {
    const h = harness();
    const r = handleWebMessage(JSON.stringify({ type: 'ready', payload: { pageVersion: 18 } }), h);
    expect(r).toEqual({ type: 'ready' });
    expect(h.posted).toHaveLength(1);
    const { type, payload } = h.posted[0];
    expect(type).toBe('init');
    expect(payload).toEqual({
      symbol: 'VELTRAVIA:BTC', description: 'Bitcoin (BTC)', exchange: 'Hyperliquid',
      interval: '30', theme: 'dark', pricescale: 100, showVolume: true, colors: COLORS,
    });
  });

  it('garbage, empty strings and unknown types are ignored silently', () => {
    const h = harness();
    expect(handleWebMessage('not json', h)).toBeNull();
    expect(handleWebMessage('{"noType":1}', h)).toBeNull();
    expect(handleWebMessage('{"type":"whatever"}', h)).toBeNull();
    expect(h.posted).toHaveLength(0);
  });
});

describe('TradingView bridge: bars requests (pull datafeed)', () => {
  it('answers a barsRequest with a barsResponse carrying the SAME id', () => {
    const h = harness();
    handleWebMessage(JSON.stringify({
      type: 'barsRequest',
      payload: { id: '7', symbol: 'VELTRAVIA:BTC', resolution: '30', from: 0, to: Math.floor(NOW / 1000) },
    }), h);
    expect(h.posted[0].type).toBe('barsResponse');
    expect(h.posted[0].payload.id).toBe('7');
    expect(h.posted[0].payload.bars.length).toBeGreaterThan(10);
    expect(h.posted[0].payload.meta).toBeDefined();
  });

  it('serves every resolution the page advertises (1, 5, 15, 30, 60, 240, 1D, 1W)', () => {
    for (const res of ['1', '5', '15', '30', '60', '240', '1D', '1W'] as const) {
      const h = harness();
      handleWebMessage(JSON.stringify({
        type: 'barsRequest',
        payload: { id: '1', resolution: res, from: 0, to: Math.floor(NOW / 1000) },
      }), h);
      expect(h.posted[0].payload.bars.length).toBeGreaterThan(0);
    }
  });

  it('bars are unix SECONDS and spaced exactly one interval apart', () => {
    const h = harness();
    handleWebMessage(JSON.stringify({
      type: 'barsRequest',
      payload: { id: '1', resolution: '30', from: 0, to: Math.floor(NOW / 1000) },
    }), h);
    const bars = h.posted[0].payload.bars;
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].time - bars[i - 1].time).toBe(INTERVAL_MS['30m'] / 1000);
    }
    expect(Number.isInteger(bars[0].time)).toBe(true);
  });

  it('countBack returns only the newest N bars; from/to window is honoured', () => {
    const h = harness();
    handleWebMessage(JSON.stringify({
      type: 'barsRequest',
      payload: { id: '1', resolution: '30', from: 0, to: Math.floor(NOW / 1000), countBack: 5 },
    }), h);
    expect(h.posted[0].payload.bars).toHaveLength(5);
  });

  it('a window before the oldest bar answers empty with meta.noData (end of history)', () => {
    const h = harness();
    handleWebMessage(JSON.stringify({
      type: 'barsRequest',
      payload: { id: '1', resolution: '30', from: 0, to: 60 },
    }), h);
    expect(h.posted[0].payload.bars).toHaveLength(0);
    expect(h.posted[0].payload.meta.noData).toBe(true);
  });

  it('panning back serves slices of ONE series: two windows agree where they overlap', () => {
    const getBars = makeBarSource('hyperliquid:BTC', 81434, NOW);
    const to = Math.floor(NOW / 1000);
    const recent = getBars({ id: 'a', symbol: 'x', resolution: '30', from: to - 3600 * 4, to });
    const older = getBars({ id: 'b', symbol: 'x', resolution: '30', from: to - 3600 * 8, to });
    const overlap = older.bars.filter((b) => b.time >= to - 3600 * 4);
    expect(recent.bars.map((b) => `${b.time}:${b.close}`))
      .toEqual(overlap.map((b) => `${b.time}:${b.close}`));
  });
});

describe('TradingView bridge: mapping and payload helpers', () => {
  it('interval <-> resolution round-trips', () => {
    for (const [iv, res] of Object.entries(intervalToResolution)) {
      expect(resolutionToInterval(res as any)).toBe(iv);
    }
  });

  it('inferPricescale: 100 for dollars, finer for small coins', () => {
    expect(inferPricescale(81434)).toBe(100);
    expect(inferPricescale(1.5)).toBe(100);
    expect(inferPricescale(0.42)).toBe(10000);
    expect(inferPricescale(0.000021)).toBe(1000000);
  });

  it('initPayload fills pricescale from the price when omitted', () => {
    const p = initPayload({ ...MARKET(), last: 0.42 });
    expect(p.pricescale).toBe(10000);
    expect(p.colors).toBe(COLORS);
  });
});

describe('TradingView bridge: data state, gestures, errors', () => {
  it('dataState empty changes reach the host callback', () => {
    const h = harness();
    let empty: boolean | null = null;
    handleWebMessage(JSON.stringify({ type: 'dataState', payload: { empty: true } }), { ...h, onEmptyChange: (e) => { empty = e; } });
    expect(empty).toBe(true);
    handleWebMessage(JSON.stringify({ type: 'dataState', payload: { empty: false } }), { ...h, onEmptyChange: (e) => { empty = e; } });
    expect(empty).toBe(false);
  });

  it('gesture events report finger-down state', () => {
    let active = false;
    const h = harness();
    handleWebMessage(JSON.stringify({ type: 'gesture', payload: { active: true } }), { ...h, onGesture: (a) => { active = a; } });
    expect(active).toBe(true);
  });

  it('page errors are routed to onError, not thrown', () => {
    const h = harness();
    const errs: string[] = [];
    expect(() => handleWebMessage(JSON.stringify({ type: 'error', payload: { where: 'widget', message: 'boom' } }), { ...h, onError: (w, m) => errs.push(`${w}:${m}`) })).not.toThrow();
    expect(errs).toEqual(['widget:boom']);
  });

  it('a barsRequest without an id is dropped (no orphan response)', () => {
    const h = harness();
    handleWebMessage(JSON.stringify({ type: 'barsRequest', payload: { resolution: '30', from: 0, to: 1 } }), h);
    expect(h.posted).toHaveLength(0);
  });
});
