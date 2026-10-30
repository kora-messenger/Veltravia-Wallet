import {
  DEFAULT_PERPS_ACTIVITY_FILTERS as DEF, applyPerpsFilters, perpsFiltersActive, activeFilterCount,
  dateRange, clampRange, supportedAssets, searchAssets, filtersEqual,
  type PerpsActivityItem, type PerpsActivityFilters,
} from '../src/core/perps/activityFilters';
import { PERP_SECTIONS } from '../src/services/perpsMarkets';

const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);
const DAY = 86_400_000;
const item = (o: Partial<PerpsActivityItem>): PerpsActivityItem => ({
  id: String(Math.random()), provider: 'hyperliquid', asset: 'BTC', type: 'trade',
  status: 'completed', timestamp: NOW - DAY, ...o,
});
const f = (o: Partial<PerpsActivityFilters>): PerpsActivityFilters => ({ ...DEF, ...o });

const SAMPLE: PerpsActivityItem[] = [
  item({ id: 'a', provider: 'hyperliquid', asset: 'BTC', type: 'trade', status: 'completed', timestamp: NOW - 2 * DAY }),
  item({ id: 'b', provider: 'aster', asset: 'ANT', type: 'order', status: 'submitted', timestamp: NOW - 20 * DAY }),
  item({ id: 'c', provider: 'hyperliquid', asset: 'ETH', type: 'transfer', status: 'processing', timestamp: NOW - 60 * DAY }),
  item({ id: 'd', provider: 'aster', asset: 'XTEN', type: 'trade', status: 'failed', timestamp: NOW - 120 * DAY }),
  item({ id: 'e', provider: 'hyperliquid', asset: 'BTC', type: 'transfer', status: 'completed', isFunding: true, timestamp: NOW - DAY }),
];
const ids = (xs: PerpsActivityItem[]) => xs.map((x) => x.id);

describe('applyPerpsFilters', () => {
  it('no filters -> every transaction, except funding payments which are off by default', () => {
    expect(ids(applyPerpsFilters(SAMPLE, DEF, NOW))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('the funding switch brings funding payments back', () => {
    expect(ids(applyPerpsFilters(SAMPLE, f({ showFundingPayment: true }), NOW))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('providers are multi-select: one, the other, or both', () => {
    expect(ids(applyPerpsFilters(SAMPLE, f({ providers: ['aster'] }), NOW))).toEqual(['b', 'd']);
    expect(ids(applyPerpsFilters(SAMPLE, f({ providers: ['hyperliquid'] }), NOW))).toEqual(['a', 'c']);
    expect(ids(applyPerpsFilters(SAMPLE, f({ providers: ['aster', 'hyperliquid'] }), NOW))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('assets, types and statuses narrow the list, and combine', () => {
    expect(ids(applyPerpsFilters(SAMPLE, f({ assets: ['BTC', 'XTEN'] }), NOW))).toEqual(['a', 'd']);
    expect(ids(applyPerpsFilters(SAMPLE, f({ type: ['trade', 'order'] }), NOW))).toEqual(['a', 'b', 'd']);
    expect(ids(applyPerpsFilters(SAMPLE, f({ status: ['failed', 'submitted'] }), NOW))).toEqual(['b', 'd']);
    expect(ids(applyPerpsFilters(SAMPLE, f({ providers: ['aster'], type: ['trade'] }), NOW))).toEqual(['d']);
  });

  it('date presets cut at 7, 30 and 90 days', () => {
    expect(ids(applyPerpsFilters(SAMPLE, f({ date: '7d' }), NOW))).toEqual(['a']);
    expect(ids(applyPerpsFilters(SAMPLE, f({ date: '30d' }), NOW))).toEqual(['a', 'b']);
    expect(ids(applyPerpsFilters(SAMPLE, f({ date: '90d' }), NOW))).toEqual(['a', 'b', 'c']);
  });

  it('a custom range keeps only what falls inside it, ends included', () => {
    const custom = f({ date: 'custom', customStart: NOW - 61 * DAY, customEnd: NOW - 20 * DAY });
    expect(ids(applyPerpsFilters(SAMPLE, custom, NOW))).toEqual(['b', 'c']);
  });

  it('a custom range with a missing end means all time rather than hiding everything', () => {
    expect(dateRange(f({ date: 'custom', customStart: NOW, customEnd: null }), NOW)).toBeNull();
  });

  it('nothing matches -> an empty list, not an error', () => {
    expect(applyPerpsFilters(SAMPLE, f({ assets: ['SP500'] }), NOW)).toEqual([]);
    expect(applyPerpsFilters([], DEF, NOW)).toEqual([]);
  });

  it('does not mutate the input', () => {
    const copy = JSON.stringify(SAMPLE);
    applyPerpsFilters(SAMPLE, f({ providers: ['aster'] }), NOW);
    expect(JSON.stringify(SAMPLE)).toBe(copy);
  });
});

describe('filter state helpers', () => {
  it('reset really is "equal to the defaults"', () => {
    const dirty = f({ providers: ['aster'], status: ['failed'], showFundingPayment: true, date: '7d' });
    expect(perpsFiltersActive(dirty)).toBe(true);
    expect(perpsFiltersActive({ ...DEF })).toBe(false);
    expect(filtersEqual(dirty, DEF)).toBe(false);
  });

  it('order of a multi-selection does not matter', () => {
    expect(filtersEqual(f({ type: ['trade', 'order'] }), f({ type: ['order', 'trade'] }))).toBe(true);
  });

  it('counts each filter family once', () => {
    expect(activeFilterCount(DEF)).toBe(0);
    expect(activeFilterCount(f({ providers: ['aster', 'hyperliquid'], assets: ['BTC', 'ETH'], date: '30d' }))).toBe(3);
  });

  it('presets are relative to now', () => {
    expect(dateRange(f({ date: '7d' }), NOW)).toEqual([NOW - 7 * DAY, NOW]);
  });
});

describe('clampRange: start can never be after end', () => {
  it('leaves a valid range alone', () => {
    expect(clampRange('start', 10, 20)).toEqual({ start: 10, end: 20 });
  });
  it('moving start past end drags end along', () => {
    expect(clampRange('start', 30, 20)).toEqual({ start: 30, end: 30 });
  });
  it('moving end before start drags start along', () => {
    expect(clampRange('end', 30, 20)).toEqual({ start: 20, end: 20 });
  });
});

describe('the asset list is the app\'s real one', () => {
  const all = supportedAssets();

  it('contains every market in PERP_SECTIONS exactly once and invents nothing', () => {
    const real = new Set(PERP_SECTIONS.flatMap((s) => s.markets.map((m) => m.symbol)));
    expect(new Set(all.map((a) => a.symbol))).toEqual(real);
    expect(all.length).toBe(real.size);
  });

  it('searches by symbol, ignoring case and spaces', () => {
    expect(searchAssets(all, ' btc ').map((a) => a.symbol)).toContain('BTC');
    expect(searchAssets(all, 'zzzz')).toEqual([]);
    expect(searchAssets(all, '').length).toBe(all.length);
  });

  it('can be narrowed to the selected providers', () => {
    const aster = searchAssets(all, '', ['aster']);
    expect(aster.length).toBeGreaterThan(0);
    expect(aster.every((a) => a.provider === 'aster')).toBe(true);
  });
});
