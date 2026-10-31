import {
  queryMarkets, parseVolume, defaultDir, favKey, FAVORITES_TAB, SEARCH_TABS, type QueryOptions,
} from '../src/services/perpsSearch';
import { resetVenuePrefs, setShowInMarkets } from '../src/services/perpsVenues';
import { PERP_SECTIONS } from '../src/services/perpsMarkets';

/**
 * The Perps search SCREEN was removed on Ijezie's instruction (31 Oct 2026) and
 * with it its screen tests. The query layer is still used by the Perps home and
 * the market page, so its logic stays under test here.
 */
const base: QueryOptions = {
  tab: 'popular', provider: 'all', query: '', sort: 'volume', dir: 'desc',
  favorites: new Set<string>(), venueVisible: { hyperliquid: true, aster: true },
};
const syms = (o: Partial<QueryOptions>) => queryMarkets({ ...base, ...o }).map((r) => r.market.symbol);

describe('search logic', () => {
  it('parses volumes with K/M/B', () => {
    expect(parseVolume('$1.70B Vol')).toBe(1.7e9);
    expect(parseVolume('$341.36M Vol')).toBe(341.36e6);
    expect(parseVolume('$90.65K Vol')).toBe(90650);
  });

  it('tabs mirror the Perps sections', () => {
    expect(SEARCH_TABS.map((t) => t.key)).toEqual(PERP_SECTIONS.map((s) => s.key));
  });

  it('default sort is volume high to low', () => {
    const v = queryMarkets(base).map((r) => parseVolume(r.market.volume));
    expect(v).toEqual([...v].sort((a, b) => b - a));
  });

  it('ascending flips the order; Name sorts A to Z', () => {
    expect(syms({ dir: 'asc' })).toEqual([...syms({})].reverse());
    const names = syms({ sort: 'name', dir: defaultDir('name') });
    expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  });

  it('provider filter narrows to one venue', () => {
    const rows = queryMarkets({ ...base, tab: 'meme', provider: 'aster' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.market.venue === 'aster')).toBe(true);
  });

  it('text search narrows within the tab, case-insensitive', () => {
    expect(syms({ query: 'bt' })).toEqual(['BTC']);
    expect(syms({ query: 'zzzz' })).toEqual([]);
  });

  it('a hidden venue (Settings > Perps) never shows', () => {
    const rows = queryMarkets({ ...base, tab: 'new', venueVisible: { hyperliquid: true, aster: false } });
    expect(rows).toEqual([]);
  });

  it('favorites tab lists only starred markets, once each', () => {
    const btc = PERP_SECTIONS[0].markets.find((m) => m.symbol === 'BTC')!;
    const favs = new Set([favKey(btc)]);
    const rows = queryMarkets({ ...base, tab: FAVORITES_TAB, favorites: favs });
    expect(rows.map((r) => r.market.symbol)).toEqual(['BTC']); // BTC is in Popular AND Crypto
  });
});
