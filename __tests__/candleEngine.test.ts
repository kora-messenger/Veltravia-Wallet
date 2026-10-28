import {
  generateSeries, initialViewport, clampViewport, panViewport, zoomViewport,
  visibleSlice, fitPriceScale, niceTicks, formatAxisTime, formatAxisPrice,
  defaultInterval, candleAtX, MAX_CANDLES, INTERVAL_MS, MIN_VISIBLE,
} from '../src/services/candleEngine';

const NOW = Date.UTC(2026, 9, 28, 8, 30);

describe('candle series', () => {
  it('is deterministic and ends exactly at the live price', () => {
    const a = generateSeries('hyperliquid:BTC', 81434, '1D', '30m', NOW);
    const b = generateSeries('hyperliquid:BTC', 81434, '1D', '30m', NOW);
    expect(a).toEqual(b);
    expect(a[a.length - 1].close).toBeCloseTo(81434, 6);
  });

  it('1D on 30m gives ~48 candles; spacing equals the interval; time ascends', () => {
    const s = generateSeries('x', 100, '1D', '30m', NOW);
    expect(s.length).toBe(48);
    for (let i = 1; i < s.length; i++) expect(s[i].t - s[i - 1].t).toBe(INTERVAL_MS['30m']);
  });

  it('never exceeds MAX_CANDLES (1m over a year is capped)', () => {
    expect(generateSeries('x', 100, '1Y', '1m', NOW).length).toBe(MAX_CANDLES);
  });

  it('candles are internally consistent (low <= open/close <= high, volume > 0)', () => {
    for (const c of generateSeries('ETH', 2364, '1W', '4h', NOW)) {
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close) + 1e-9);
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close) - 1e-9);
      expect(c.volume).toBeGreaterThan(0);
    }
  });

  it('different markets and intervals produce different charts', () => {
    const a = generateSeries('BTC', 100, '1D', '30m', NOW).map((c) => c.close);
    const b = generateSeries('ETH', 100, '1D', '30m', NOW).map((c) => c.close);
    const c = generateSeries('BTC', 100, '1D', '1h', NOW).map((c2) => c2.close);
    expect(a).not.toEqual(b);
    expect(a.length).not.toBe(c.length);
  });

  it('range chips pick the interval Trust opens on', () => {
    expect(defaultInterval('1D')).toBe('30m');
    expect(defaultInterval('1H')).toBe('1m');
    expect(defaultInterval('1Y')).toBe('1d');
  });
});

describe('viewport: pan and zoom', () => {
  const total = 100;
  const plot = 400;

  it('opens on the most recent candles with a little air on the right', () => {
    const v = initialViewport(total);
    expect(v.count).toBe(90);
    expect(v.start + v.count).toBeGreaterThan(total); // blank space on the right
  });

  it('dragging right reveals older candles; dragging left newer ones', () => {
    const v = { start: 50, count: 40 };
    expect(panViewport(v, 40, plot, total).start).toBeLessThan(50);
    expect(panViewport(v, -40, plot, total).start).toBeGreaterThan(50);
  });

  it('cannot be scrolled far past either end', () => {
    const left = panViewport({ start: 0, count: 40 }, 100000, plot, total);
    expect(left.start).toBeGreaterThanOrEqual(-20);
    const right = panViewport({ start: 60, count: 40 }, -100000, plot, total);
    expect(right.start).toBeLessThanOrEqual(total - 20);
  });

  it('pinch out (scale>1) shows fewer candles, pinch in shows more', () => {
    const v = { start: 20, count: 40 };
    expect(zoomViewport(v, 2, 200, plot, total).count).toBeCloseTo(20, 5);
    expect(zoomViewport(v, 0.5, 200, plot, total).count).toBeCloseTo(80, 5);
  });

  it('zoom keeps the candle under the fingers in place', () => {
    const v = { start: 20, count: 40 };
    const focal = 100; // 25% across
    const before = v.start + (focal / plot) * v.count;
    const z = zoomViewport(v, 2, focal, plot, total);
    const after = z.start + (focal / plot) * z.count;
    expect(after).toBeCloseTo(before, 5);
  });

  it('zoom is bounded: never fewer than MIN_VISIBLE candles', () => {
    expect(zoomViewport({ start: 20, count: 40 }, 5, 200, plot, total).count).toBeGreaterThanOrEqual(MIN_VISIBLE);
    expect(zoomViewport({ start: 20, count: 10 }, 5, 200, plot, total).count).toBeGreaterThanOrEqual(MIN_VISIBLE);
  });

  it('visibleSlice returns only candles inside the window', () => {
    const candles = generateSeries('x', 100, '1D', '30m', NOW);
    const { first, items } = visibleSlice(candles, { start: 10, count: 20 });
    expect(first).toBe(10);
    expect(items.length).toBe(20);
    expect(visibleSlice(candles, { start: -5, count: 10 }).first).toBe(0);
  });

  it('clampViewport keeps start within bounds', () => {
    const v = clampViewport({ start: 9999, count: 40 }, total);
    expect(v.start).toBeLessThanOrEqual(total);
  });
});

describe('price scale auto-fit (Trust re-fits to what is on screen)', () => {
  const candles = generateSeries('BTC', 81434, '1D', '30m', NOW);

  it('covers every visible high/low with padding', () => {
    const { items } = visibleSlice(candles, { start: 0, count: 48 });
    const s = fitPriceScale(items, 81434);
    for (const c of items) { expect(c.low).toBeGreaterThanOrEqual(s.min); expect(c.high).toBeLessThanOrEqual(s.max); }
  });

  it('zooming into a window narrows the scale (the 20s frame: 79.8K-81.6K vs 78K-83.5K)', () => {
    const wide = fitPriceScale(visibleSlice(candles, { start: 0, count: 48 }).items, 81434);
    const tight = fitPriceScale(visibleSlice(candles, { start: 36, count: 12 }).items, 81434);
    expect(tight.max - tight.min).toBeLessThan(wide.max - wide.min);
  });

  it('empty window falls back to a band around the price', () => {
    const s = fitPriceScale([], 100);
    expect(s.min).toBeLessThan(100);
    expect(s.max).toBeGreaterThan(100);
  });
});

describe('axis ticks and labels', () => {
  it('niceTicks produce round, evenly spaced values inside the range', () => {
    const t = niceTicks(79300, 82900, 8);
    expect(t.length).toBeGreaterThanOrEqual(4);
    expect(t.length).toBeLessThanOrEqual(12);
    const step = t[1] - t[0];
    for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeCloseTo(step, 6);
    expect(t[0]).toBeGreaterThanOrEqual(79300);
    expect(t[t.length - 1]).toBeLessThanOrEqual(82900);
    expect([100, 200, 250, 500, 1000]).toContain(step);
  });

  it('formats axis prices with Trust-style two decimals and thousands separators', () => {
    expect(formatAxisPrice(81600, 200)).toBe('81,600.00');
    expect(formatAxisPrice(0.4123, 0.001)).toBe('0.4123');
  });

  it('time labels: HH:mm, and the day number at midnight (the bold "28")', () => {
    expect(formatAxisTime(Date.UTC(2026, 9, 28, 12, 0), '30m')).toBe('12:00');
    expect(formatAxisTime(Date.UTC(2026, 9, 28, 0, 0), '30m')).toBe('28');
    expect(formatAxisTime(Date.UTC(2026, 9, 28, 6, 0), '1h')).toBe('06:00');
    expect(formatAxisTime(Date.UTC(2026, 9, 5, 0, 0), '1d')).toBe('5');
  });
});

describe('crosshair', () => {
  it('maps a touch x to the candle under it, clamped to the series', () => {
    const v = { start: 10, count: 40 };
    expect(candleAtX(0, v, 400, 100)).toBe(10);
    expect(candleAtX(399, v, 400, 100)).toBe(49);   // last pixel column = last visible candle
    expect(candleAtX(200, v, 400, 100)).toBe(30);   // middle
    expect(candleAtX(-50, { start: -5, count: 10 }, 400, 100)).toBe(0);
    expect(candleAtX(400, { start: 95, count: 40 }, 400, 100)).toBe(99);
  });
});
