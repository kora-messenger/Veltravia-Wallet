import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', background: '#FFFFFF', surface: '#F5F5F7', surfaceAlt: '#FFFFFF' } }),
}));
jest.mock('../src/wallets/WalletsProvider', () => ({
  useWallets: () => ({ activeWallet: { id: 'w1' } }),
}));
jest.mock('../src/core/storage/secureStorage', () => ({
  readSettings: jest.fn(async () => ({})),
  writeSettings: jest.fn(async () => ({})),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));

// Session loading: default true so existing tests mount past the fetch;
// the loading test flips it to false to exercise the fresh-open skeleton.
let mockSessionLoaded = true;
let resolveLoad: () => void = () => {};
jest.mock('../src/services/perpsAccount', () => {
  const actual = jest.requireActual('../src/services/perpsAccount');
  return {
    ...actual,
    // wrapped so a pull-to-refresh can be proven to re-read the account
    loadPerpsAccounts: jest.fn((...a: any[]) => actual.loadPerpsAccounts(...a)),
    perpsSessionLoaded: () => mockSessionLoaded,
    ensurePerpsSessionLoad: () =>
      new Promise<void>((res) => { resolveLoad = () => { mockSessionLoaded = true; res(); }; }),
  };
});

import PerpsScreen from '../src/screens/PerpsScreen';
import * as perpsAccountModule from '../src/services/perpsAccount';
import * as perpsFavModule from '../src/services/perpsFavorites';
import * as venuesModule from '../src/services/perpsVenues';
import {
  depositToPerps, withdrawFromPerps, getPerpsAccount, isFunded, accountValue, resetPerpsAccounts,
} from '../src/services/perpsAccount';
import { formatPerpPrice, formatChange, perpSpark, PERP_SECTIONS } from '../src/services/perpsMarkets';
import { toggleFavorite, resetPerpsFavorites } from '../src/services/perpsFavorites';
import { resetVenuePrefs, setShowInMarkets } from '../src/services/perpsVenues';

// Flatten string children; array children (text + newline + text) join into one string.
const texts = (tree: renderer.ReactTestRenderer) =>
  tree.root
    .findAll((n) => typeof n.props.children === 'string' || (Array.isArray(n.props.children) && n.props.children.every((c: unknown) => typeof c === 'string')))
    .map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : (n.props.children as string)));

const mount = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer><PerpsScreen /></NavigationContainer>
      </SafeAreaProvider>,
    ); });
  return tree;
};

describe('pull to refresh on the Perps home', () => {
  it('re-reads the account, the starred markets and the venue prefs', async () => {
    const accounts = perpsAccountModule.loadPerpsAccounts as unknown as jest.Mock;
    accounts.mockClear();
    const favs = jest.spyOn(perpsFavModule, 'loadPerpsFavorites').mockResolvedValue();
    const venues = jest.spyOn(venuesModule, 'loadVenuePrefs').mockResolvedValue();

    const tree = await mount();
    const pull = tree.root.findAll((n) => n.props.refreshControl && n.props.refreshControl.props.onRefresh)[0];
    await act(async () => { await pull.props.refreshControl.props.onRefresh(); });

    expect(accounts).toHaveBeenCalled();
    expect(favs).toHaveBeenCalled();
    expect(venues).toHaveBeenCalled();
    await act(async () => { tree.unmount(); });
    [favs, venues].forEach((sp) => sp.mockRestore());
  });
});

describe('perps account', () => {
  beforeEach(() => resetPerpsAccounts());

  it('starts empty and unfunded (separate from the main wallet)', () => {
    const a = getPerpsAccount('w1');
    expect(isFunded(a)).toBe(false);
    expect(accountValue(a)).toBe(0);
  });

  it('deposit funds the account; withdraw is capped to the free balance', () => {
    depositToPerps('w1', 100);
    expect(getPerpsAccount('w1').available).toBe(100);
    expect(withdrawFromPerps('w1', 150)).toBe(false); // over the free balance
    expect(withdrawFromPerps('w1', 40)).toBe(true);
    expect(getPerpsAccount('w1').available).toBe(60);
  });

  it('ignores non-positive deposits and keeps wallets independent', () => {
    depositToPerps('w1', 0);
    depositToPerps('w1', -5);
    expect(isFunded(getPerpsAccount('w1'))).toBe(false);
    depositToPerps('w2', 25);
    expect(isFunded(getPerpsAccount('w1'))).toBe(false);
    expect(getPerpsAccount('w2').available).toBe(25);
  });
});

describe('perps home', () => {
  beforeEach(() => { resetPerpsAccounts(); mockSessionLoaded = true; });

  it('fresh open: shows the balance skeleton while fetching, then the real state', async () => {
    mockSessionLoaded = false;
    const t = await mount();
    // during the fetch: live label + skeleton pill, no hero and no balance yet
    expect(texts(t)).toContain('Available balance');
    expect(texts(t).some((x) => x.includes('Deposit to fund'))).toBe(false);
    expect(texts(t).some((x) => x.includes('Perps balance'))).toBe(false);
    // the +/- deposit & withdraw circles are present even while loading
    const labels = t.root.findAll((n) => typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel);
    expect(labels).toContain('Deposit');
    expect(labels).toContain('Withdraw');
    // fetch resolves -> the real (unfunded) state renders
    await act(async () => { resolveLoad(); });
    expect(texts(t).some((x) => x.includes('Deposit to fund'))).toBe(true);
    await act(async () => { t.unmount(); });
  });

  it('unfunded: shows the deposit hero, not a balance', async () => {
    const t = await mount();
    const all = texts(t);
    expect(all.some((s) => s.includes('Deposit to fund'))).toBe(true);
    expect(all).not.toContain('Perps balance');
    await act(async () => { t.unmount(); });
  });

  it('funded: hero disappears and the perps balance shows', async () => {
    depositToPerps('w1', 250);
    const t = await mount();
    const all = texts(t);
    expect(all.some((s) => s.includes('Deposit to fund'))).toBe(false);
    expect(all).toContain('Perps balance');
    expect(all).toContain('$250.00');
    const labels = t.root.findAll((n) => typeof n.props.accessibilityLabel === 'string').map((n) => n.props.accessibilityLabel);
    expect(labels).toContain('Deposit');    // plus circle
    expect(labels).toContain('Withdraw');   // minus circle
    await act(async () => { t.unmount(); });
  });

  it('lists the market sections; no floating Long / Short pills (the side is chosen on the market page)', async () => {
    const t = await mount();
    const all = texts(t);
    for (const title of ['Popular', 'New', 'Stocks', 'Crypto', 'Pre-IPO', 'Commodities', 'FX', 'Meme']) expect(all).toContain(title);
    expect(all).not.toContain('Long');
    expect(all).not.toContain('Short');
    await act(async () => { t.unmount(); });
  });
});

describe('perps markets data', () => {
  it('formats prices with Trust-style precision', () => {
    expect(formatPerpPrice(80772)).toBe('$80,772.0');
    expect(formatPerpPrice(157.85)).toBe('$157.85');
    expect(formatPerpPrice(81.192)).toBe('$81.192');
    expect(formatPerpPrice(1.4784)).toBe('$1.4784');
    expect(formatPerpPrice(0.06691)).toBe('$0.06691');
    expect(formatPerpPrice(0.0007844)).toBe('$0.0007844');
  });
  it('formats signed 24h change', () => {
    expect(formatChange(5.71)).toBe('+5.71%');
    expect(formatChange(-2.95)).toBe('-2.95%');
  });
  it('sparkline is deterministic and ends in the direction of the change', () => {
    expect(perpSpark('X', 3)).toEqual(perpSpark('X', 3));
    expect(PERP_SECTIONS.map((x) => x.title)).toEqual(['Popular', 'New', 'Stocks', 'Crypto', 'Pre-IPO', 'Commodities', 'FX', 'Meme']);
  });
});

describe('Watchlist on the Perps home (Trust parity)', () => {
  beforeEach(() => { resetPerpsAccounts(); resetPerpsFavorites(); resetVenuePrefs(); mockSessionLoaded = true; });

  it('no favorites: there is no Watchlist section at all', async () => {
    const t = await mount();
    expect(texts(t)).not.toContain('Watchlist');
    expect(texts(t)).toContain('Popular');
    await act(async () => { t.unmount(); });
  });

  it('a favorite appears under Watchlist ABOVE Popular; removing the last one makes it disappear', async () => {
    const t = await mount();
    await act(async () => { toggleFavorite('hyperliquid:BTC'); });
    const order = [...new Set(texts(t).filter((x) => x === 'Watchlist' || x === 'Popular'))];
    expect(order).toEqual(['Watchlist', 'Popular']); // first appearance order = top to bottom
    // BTC is listed in the watchlist AND still in Popular
    const btcRows = t.root.findAll((n) => n.props.accessibilityLabel === 'Market BTC' && typeof n.props.onPress === 'function');
    expect(btcRows.length).toBeGreaterThanOrEqual(2);
    await act(async () => { toggleFavorite('hyperliquid:BTC'); });
    expect(texts(t)).not.toContain('Watchlist');
    await act(async () => { t.unmount(); });
  });

  it('a market starred in several sections is listed once; hidden venues stay out', async () => {
    const t = await mount();
    await act(async () => { toggleFavorite('hyperliquid:ETH'); toggleFavorite('aster:ANT'); });
    await act(async () => { setShowInMarkets('aster', false); });
    // ETH (also in Popular+Crypto) once in Watchlist; ANT's venue is hidden so it is not listed
    const watchRows = t.root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel === 'Market ETH' && typeof n.props.onPress === 'function');
    expect(watchRows.length).toBeGreaterThanOrEqual(1);
    expect(texts(t)).toContain('Watchlist');
    await act(async () => { toggleFavorite('hyperliquid:ETH'); });
    expect(texts(t)).not.toContain('Watchlist'); // ANT is the only favorite left but its venue is hidden
    await act(async () => { t.unmount(); });
  });

  it('tapping a market row opens that market\'s page', async () => {
    const { createNativeStackNavigator } = require('@react-navigation/native-stack');
    const Stack = createNativeStackNavigator();
    const Market = () => null;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Perps">
              <Stack.Screen name="Perps" component={PerpsScreen} />
              <Stack.Screen name="PerpsMarket" component={Market} />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>,
      );
    });
    const row = tree.root.findAll((n) => n.props.accessibilityLabel === 'Market ETH' && typeof n.props.onPress === 'function')[0];
    await act(async () => { row.props.onPress(); });
    const route = tree.root.findByType(Market).props.route;
    expect(route.name).toBe('PerpsMarket');
    expect(route.params).toEqual({ venue: 'hyperliquid', symbol: 'ETH' });
    expect(route.params.side).toBeUndefined();      // never a long/short jump
    await act(async () => { tree.unmount(); });
  });

  it('the search icon is gone with the removed screen; a coin still opens its page', async () => {
    // The search screen was deleted on Ijezie's instruction (31 Oct 2026), so the
    // header must not keep a button that leads nowhere.
    const { createNativeStackNavigator } = require('@react-navigation/native-stack');
    const Stack = createNativeStackNavigator();
    const Market = () => null;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Perps">
              <Stack.Screen name="Perps" component={PerpsScreen} />
              <Stack.Screen name="PerpsMarket" component={Market} />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>,
      );
    });
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Search perps').length).toBe(0);
    await act(async () => {
      tree.root.findAll((n) => n.props.accessibilityLabel === 'Market ETH' && typeof n.props.onPress === 'function')[0].props.onPress();
    });
    const route = tree.root.findByType(Market).props.route;
    expect(route.name).toBe('PerpsMarket');
    expect(route.params).toEqual({ venue: 'hyperliquid', symbol: 'ETH' });
    await act(async () => { tree.unmount(); });
  });
});
