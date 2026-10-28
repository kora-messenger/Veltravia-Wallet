import {
  TREND_RANGES, trendSeries, pointIndexAtX, scrubAt, formatScrubStamp, formatScrubChange,
  trendInterval, ALL_SPAN_DAYS,
} from '../src/services/trendEngine';

const NOW = new Date(2026, 9, 28, 10, 8).getTime(); // Oct 28 2026, 10:08 local

describe('trend ranges', () => {
  it('lists exactly the seven Trust chips: 1H 1D 1W 1M 1Y YTD ALL', () => {
    expect(TREND_RANGES).toEqual(['1H', '1D', '1W', '1M', '1Y', 'YTD', 'ALL']);
  });
  it('ALL uses daily points; others use the candle default interval', () => {
    expect(trendInterval('ALL')).toBe('1d');
    expect(trendInterval('1H')).toBe('1m');
    expect(trendInterval('1D')).toBe('30m');
  });
});

describe('trendSeries', () => {
  it('every range is oldest -> newest and ENDS exactly at the live price', () => {
    for (const r of TREND_RANGES) {
      const pts = trendSeries('hyperliquid:BTC', 81431, r, NOW);
      expect(pts.length).toBeGreaterThan(10);
      expect(pts[pts.length - 1].price).toBe(81431);
      for (let i = 1; i < pts.length; i++) expect(pts[i].t).toBeGreaterThan(pts[i - 1].t);
    }
  });
  it('is deterministic for the same market, and differs between markets', () => {
    const a = trendSeries('hyperliquid:BTC', 81431, '1D', NOW).map((p) => p.price);
    const b = trendSeries('hyperliquid:BTC', 81431, '1D', NOW).map((p) => p.price);
    const c = trendSeries('hyperliquid:ETH', 81431, '1D', NOW).map((p) => p.price);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
  it('ALL reaches back about four years and stays positive', () => {
    const pts = trendSeries('hyperliquid:BTC', 81431, 'ALL', NOW);
    const spanDays = (pts[pts.length - 1].t - pts[0].t) / 86_400_000;
    expect(spanDays).toBeGreaterThan(ALL_SPAN_DAYS - 10);
    expect(Math.min(...pts.map((p) => p.price))).toBeGreaterThan(0);
  });
});

describe('scrubbing', () => {
  const pts = trendSeries('hyperliquid:BTC', 81431, '1D', NOW);
  it('maps a finger x to a point index, clamped to both ends', () => {
    expect(pointIndexAtX(-50, 300, 50)).toBe(0);
    expect(pointIndexAtX(0, 300, 50)).toBe(0);
    expect(pointIndexAtX(300, 300, 50)).toBe(49);
    expect(pointIndexAtX(999, 300, 50)).toBe(49);
    expect(pointIndexAtX(150, 300, 50)).toBe(Math.round(0.5 * 49));
    expect(pointIndexAtX(10, 0, 50)).toBe(0);
    expect(pointIndexAtX(10, 300, 1)).toBe(0);
  });
  it('change is measured from the FIRST point of the range', () => {
    const s = scrubAt(pts, 20);
    expect(s.price).toBe(pts[20].price);
    expect(s.delta).toBeCloseTo(pts[20].price - pts[0].price, 6);
    expect(s.pct).toBeCloseTo(((pts[20].price - pts[0].price) / pts[0].price) * 100, 6);
    expect(scrubAt(pts, 0).delta).toBe(0);
    expect(scrubAt(pts, 9999).index).toBe(pts.length - 1);
  });
});

describe('header formatting (Trust 10:08 values)', () => {
  it('short ranges show "Oct 27, 2:30 PM"', () => {
    const t = new Date(2026, 9, 27, 14, 30).getTime();
    expect(formatScrubStamp(t, '1D')).toBe('Oct 27, 2:30 PM');
    expect(formatScrubStamp(new Date(2026, 9, 28, 9, 0).getTime(), '1H')).toBe('Oct 28, 9:00 AM');
    expect(formatScrubStamp(new Date(2026, 9, 28, 0, 5).getTime(), '1W')).toBe('Oct 28, 12:05 AM');
    expect(formatScrubStamp(new Date(2026, 9, 28, 12, 0).getTime(), '1M')).toBe('Oct 28, 12:00 PM');
  });
  it('long ranges show the year instead of the time', () => {
    const t = new Date(2024, 2, 3, 14, 30).getTime();
    expect(formatScrubStamp(t, 'ALL')).toBe('Mar 3, 2024');
    expect(formatScrubStamp(t, '1Y')).toBe('Mar 3, 2024');
    expect(formatScrubStamp(t, 'YTD')).toBe('Mar 3, 2024');
  });
  it('change line matches "+$1,579.0 (1.98%)" / "-$185.0 (0.23%)"', () => {
    expect(formatScrubChange(1579, 1.98)).toBe('+$1,579.0 (1.98%)');
    expect(formatScrubChange(-185, -0.23)).toBe('-$185.0 (0.23%)');
    expect(formatScrubChange(0, 0)).toBe('+$0.0000 (0.00%)');
    expect(formatScrubChange(0.0421, 3.1)).toBe('+$0.0421 (3.10%)');
  });
});
