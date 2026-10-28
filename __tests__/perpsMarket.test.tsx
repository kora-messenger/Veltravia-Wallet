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
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));

import PerpsMarketScreen, { findMarket } from '../src/screens/PerpsMarketScreen';
import { getPerpsRecents, resetPerpsRecents } from '../src/services/perpsRecents';
import { resetPerpsFavorites } from '../src/services/perpsFavorites';
import { queryMarkets, FAVORITES_TAB } from '../src/services/perpsSearch';
import { favKey } from '../src/services/perpsSearch';
import { usePerpsFavorites } from '../src/services/perpsFavorites';

const texts = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

let currentFavs: ReadonlySet<string> = new Set();
const Spy = () => { currentFavs = usePerpsFavorites(); return null; };

const mount = async (params: { venue: 'hyperliquid' | 'aster'; symbol: string }) => {
  const Stack = createNativeStackNavigator<Record<string, object | undefined>>();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <Spy />
        <NavigationContainer>
          <Stack.Navigator initialRouteName="PerpsMarket">
            <Stack.Screen name="PerpsMarket" component={PerpsMarketScreen} initialParams={params} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  return tree;
};
const press = async (t: renderer.ReactTestRenderer, label: string) => {
  const n = t.root.find((x) => x.props.accessibilityLabel === label && typeof x.props.onPress === 'function');
  await act(async () => { n.props.onPress(); });
};

describe('Perps market page', () => {
  beforeEach(() => { resetPerpsFavorites(); resetPerpsRecents(); });

  it('shows the market: symbol, leverage, price, change, Long / Short, provider', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    const all = texts(t);
    expect(all).toContain('BTC');
    expect(all).toContain('40x');
    expect(all).toContain('$80,772.0');
    expect(all).toContain('Long');
    expect(all).toContain('Short');
    expect(all).toContain('Hyperliquid');
    expect(all).toContain('About BTC');
    await act(async () => { t.unmount(); });
  });

  it('opening a market records it in Recents', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'ETH' });
    expect(getPerpsRecents()).toEqual([{ venue: 'hyperliquid', symbol: 'ETH' }]);
    await act(async () => { t.unmount(); });
  });

  it('the star adds the market to favorites (star tab + Watchlist) and un-starring removes it', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    const btc = findMarket('hyperliquid', 'BTC')!;
    expect(currentFavs.has(favKey(btc))).toBe(false);

    await press(t, 'Add to favorites');
    expect(currentFavs.has(favKey(btc))).toBe(true);
    // it now shows in the star tab of Search market
    const star = queryMarkets({
      tab: FAVORITES_TAB, provider: 'all', query: '', sort: 'volume', dir: 'desc',
      favorites: currentFavs, venueVisible: { hyperliquid: true, aster: true },
    });
    expect(star.map((r) => r.market.symbol)).toEqual(['BTC']);

    await press(t, 'Remove from favorites');
    expect(currentFavs.has(favKey(btc))).toBe(false);
    await act(async () => { t.unmount(); });
  });

  it('an Aster market is provided by Aster', async () => {
    const t = await mount({ venue: 'aster', symbol: 'ANT' });
    expect(texts(t)).toContain('Aster');
    await act(async () => { t.unmount(); });
  });

  it('an unknown market shows a safe fallback', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'NOPE' });
    expect(texts(t)).toContain('Market not found');
    await act(async () => { t.unmount(); });
  });
});

describe('Swipe-to-delete on the star tab (Trust recording 35s)', () => {
  it('the Delete action removes the market from favorites', async () => {
    const PerpsSearchScreen = require('../src/screens/PerpsSearchScreen').default;
    const { toggleFavorite, resetPerpsFavorites: rf } = require('../src/services/perpsFavorites');
    rf();
    const Stack = createNativeStackNavigator<Record<string, object | undefined>>();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <Spy />
          <NavigationContainer>
            <Stack.Navigator initialRouteName="PerpsSearch">
              <Stack.Screen name="PerpsSearch" component={PerpsSearchScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>,
      );
    });
    await act(async () => { toggleFavorite('hyperliquid:BTC'); });
    expect(currentFavs.has('hyperliquid:BTC')).toBe(true);
    const del = tree.root.find((n) => n.props.accessibilityLabel === 'Delete BTC' && typeof n.props.onPress === 'function');
    await act(async () => { del.props.onPress(); });
    expect(currentFavs.has('hyperliquid:BTC')).toBe(false);
    await act(async () => { tree.unmount(); });
  });
});
