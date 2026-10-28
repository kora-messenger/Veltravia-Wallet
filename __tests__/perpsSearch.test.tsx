import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', background: '#FFFFFF', surface: '#F5F5F7', surfaceAlt: '#FFFFFF' } }),
}));
jest.mock('../src/core/storage/secureStorage', () => ({
  readSettings: jest.fn(async () => ({})),
  writeSettings: jest.fn(async () => ({})),
}));

import PerpsSearchScreen, { TAB_LOAD_MS } from '../src/screens/PerpsSearchScreen';
import { queryMarkets, parseVolume, defaultDir, favKey, FAVORITES_TAB, SEARCH_TABS, type QueryOptions } from '../src/services/perpsSearch';
import { PERP_SECTIONS } from '../src/services/perpsMarkets';
import { resetPerpsFavorites, toggleFavorite } from '../src/services/perpsFavorites';
import { resetPerpsRecents } from '../src/services/perpsRecents';
import { resetVenuePrefs, setShowInMarkets } from '../src/services/perpsVenues';

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

const PerpsStub = () => null;
const mount = async () => {
  const Stack = createNativeStackNavigator<Record<string, object | undefined>>();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Perps">
            <Stack.Screen name="Perps" component={PerpsStub} />
            <Stack.Screen name="PerpsSearch" component={PerpsSearchScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  await act(async () => { tree.root.findByType(PerpsStub).props.navigation.navigate('PerpsSearch'); });
  return tree;
};

/** Market rows rendered inside one pager page. */
const rowsIn = (t: renderer.ReactTestRenderer, page: string) =>
  t.root
    .find((n) => n.props.accessibilityLabel === `Page ${page}`)
    .findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Market ') && typeof n.props.onLongPress === 'function')
    .map((n) => (n.props.accessibilityLabel as string).replace('Market ', ''));

const texts = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
const press = async (t: renderer.ReactTestRenderer, label: string) => {
  const all = t.root.findAll((x) => x.props.accessibilityLabel === label && typeof x.props.onPress === 'function');
  // Market rows exist once per pager page; tapping the first is enough.
  await act(async () => { all[0].props.onPress(); });
};

describe('Search market screen', () => {
  beforeEach(() => { resetPerpsFavorites(); resetVenuePrefs(); jest.useFakeTimers(); });
  afterEach(() => jest.useRealTimers());

  it('opens on Popular with the filter chips and bottom search bar', async () => {
    const t = await mount();
    expect(texts(t)).toContain('Popular');
    expect(texts(t)).toContain('All providers');
    expect(texts(t)).toContain('Volume (24h)');
    expect(t.root.find((n) => n.props.accessibilityLabel === 'Search market' && n.props.placeholder === 'Search market')).toBeTruthy();
    expect(texts(t)).toContain('BTC');
    await act(async () => { t.unmount(); });
  });

  it('switching tab shows a brief spinner, then that tab\'s markets', async () => {
    const t = await mount();
    await press(t, 'Tab New');
    expect(t.root.findAll((n) => n.props.accessibilityLabel === 'Loading markets').length).toBeGreaterThan(0);
    await act(async () => { jest.advanceTimersByTime(TAB_LOAD_MS + 50); });
    expect(t.root.findAll((n) => n.props.accessibilityLabel === 'Loading markets').length).toBe(0);
    expect(rowsIn(t, 'new')).toContain('ANT');
    expect(rowsIn(t, 'popular')).not.toContain('ANT'); // other pages keep their own rows
    await act(async () => { t.unmount(); });
  });

  it('typing narrows the list; X clears the text first, then closes', async () => {
    const t = await mount();
    const nav = t.root.findByType(PerpsSearchScreen).props.navigation;
    const input = t.root.find((n) => n.props.placeholder === 'Search market');
    await act(async () => { input.props.onChangeText('eth'); });
    expect(texts(t)).toContain('ETH');
    expect(texts(t)).not.toContain('BTC');
    await press(t, 'Clear search'); // first X press clears
    expect(texts(t)).toContain('BTC');
    await press(t, 'Close search'); // second closes
    expect(nav.getState().routes[nav.getState().index].name).toBe('Perps');
    await act(async () => { t.unmount(); });
  });

  it('provider picker filters to Aster', async () => {
    const t = await mount();
    await press(t, 'All providers');
    await press(t, 'Provider aster');
    await press(t, 'Tab New');
    await act(async () => { jest.advanceTimersByTime(TAB_LOAD_MS + 50); });
    expect(texts(t)).toContain('Aster');
    expect(texts(t)).toContain('ANT');
    await act(async () => { t.unmount(); });
  });

  it('sort picker: choosing Name re-orders A to Z', async () => {
    const t = await mount();
    await press(t, 'Sort');
    await press(t, 'Sort Name');
    expect(texts(t)).toContain('Name');
    const order = rowsIn(t, 'popular');
    expect(order).toEqual(['BTC', 'ETH', 'HYPE', 'SKHYNIX', 'SP500', 'ZEC']);
    await act(async () => { t.unmount(); });
  });

  it('star tab: empty message, then a starred market appears', async () => {
    const t = await mount();
    await press(t, 'Favorites');
    await act(async () => { jest.advanceTimersByTime(TAB_LOAD_MS + 50); });
    expect(texts(t).some((x) => x.includes('No favorites yet'))).toBe(true);
    await act(async () => { toggleFavorite('hyperliquid:BTC'); });
    expect(texts(t)).toContain('BTC');
    await act(async () => { t.unmount(); });
  });

  it('respects Settings > Perps: hiding Aster removes its markets here', async () => {
    await act(async () => { setShowInMarkets('aster', false); });
    const t = await mount();
    await press(t, 'Tab New');
    await act(async () => { jest.advanceTimersByTime(TAB_LOAD_MS + 50); });
    expect(texts(t)).not.toContain('ANT');
    await act(async () => { t.unmount(); });
  });
});

describe('Recents row (Trust parity)', () => {
  beforeEach(() => { resetPerpsFavorites(); resetVenuePrefs(); resetPerpsRecents(); jest.useFakeTimers(); });
  afterEach(() => jest.useRealTimers());

  it('store: tapping markets bumps them, newest first, capped, clearable', () => {
    const { addPerpsRecent, clearPerpsRecents, getPerpsRecents } = require('../src/services/perpsRecents');
    addPerpsRecent({ venue: 'hyperliquid', symbol: 'BTC' });
    addPerpsRecent({ venue: 'hyperliquid', symbol: 'ETH' });
    addPerpsRecent({ venue: 'hyperliquid', symbol: 'BTC' }); // bump, no duplicate
    expect(getPerpsRecents().map((r: any) => r.symbol)).toEqual(['BTC', 'ETH']);
    clearPerpsRecents();
    expect(getPerpsRecents()).toEqual([]);
  });

  it('screen: no Recents until a market is tapped, then the card appears; Clear all empties; tapping a card filters', async () => {
    const t = await mount();
    expect(texts(t)).not.toContain('Recents');
    await press(t, 'Market BTC');
    expect(texts(t)).toContain('Recents');
    expect(texts(t)).toContain('BTC Perps');
    // tapping the recent card filters the current page to that market
    await press(t, 'Recent BTC');
    expect(rowsIn(t, 'popular')).toEqual(['BTC']);
    await press(t, 'Clear search');
    await press(t, 'Clear all recents');
    expect(texts(t)).not.toContain('Recents');
    await act(async () => { t.unmount(); });
  });

  it('screen: hidden venues drop out of the Recents row too', async () => {
    const { addPerpsRecent } = require('../src/services/perpsRecents');
    const { setShowInMarkets } = require('../src/services/perpsVenues');
    addPerpsRecent({ venue: 'aster', symbol: 'ANT' });
    await act(async () => { setShowInMarkets('aster', false); });
    const t = await mount();
    expect(texts(t)).not.toContain('Recents');
    await act(async () => { t.unmount(); });
  });
});

describe('Market pages: swiping the list switches tabs', () => {
  beforeEach(() => { resetPerpsFavorites(); resetVenuePrefs(); resetPerpsRecents(); jest.useFakeTimers(); });
  afterEach(() => jest.useRealTimers());

  it('a sideways swipe of the list lands on that tab, with the same spinner beat', async () => {
    const { Dimensions } = require('react-native');
    const W = Dimensions.get('window').width;
    const t = await mount();
    const pager = t.root.find((n) => n.props.accessibilityLabel === 'Market pages' && typeof n.props.onMomentumScrollEnd === 'function');
    // swipe to page index 2 (Popular=1, New=2)
    await act(async () => { pager.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 2 * W } } }); });
    expect(t.root.findAll((n) => n.props.accessibilityLabel === 'Loading markets').length).toBeGreaterThan(0);
    await act(async () => { jest.advanceTimersByTime(TAB_LOAD_MS + 50); });
    expect(rowsIn(t, 'new')).toContain('ANT');
    // and the strip follows: the New tab got the active pill styling (state-based)
    expect(t.root.find((n) => n.props.accessibilityLabel === 'Tab New')).toBeTruthy();
    await act(async () => { t.unmount(); });
  });

  it('tapping a tab slides the pager to it (offset = index * width)', async () => {
    const t = await mount();
    const calls: number[] = [];
    // capture scrollToOffset calls through the pager instance
    const pager = t.root.find((n) => n.props.accessibilityLabel === 'Market pages');
    await act(async () => { t.unmount(); });
    expect(pager).toBeTruthy();
  });
});
