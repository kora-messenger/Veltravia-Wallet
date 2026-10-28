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
const texts = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
const press = async (t: renderer.ReactTestRenderer, label: string) => {
  const n = t.root.find((x) => x.props.accessibilityLabel === label && typeof x.props.onPress === 'function');
  await act(async () => { n.props.onPress(); });
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
    expect(texts(t)).toContain('ANT');
    expect(texts(t)).not.toContain('BTC');
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
    // read the row order from the market rows themselves (one per row)
    const order = t.root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Market ') && typeof n.props.onLongPress === 'function')
      .map((n) => (n.props.accessibilityLabel as string).replace('Market ', ''));
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
