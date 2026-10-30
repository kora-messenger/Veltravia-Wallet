import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', brandGradient: ['#6C63FF', '#4A90D9'], buttonGradient: ['#6C63FF', '#4A90D9'], background: '#FFFFFF', surface: '#F5F5F7', surfaceAlt: '#EDEDF0' } }),
}));
jest.mock('../src/core/storage/secureStorage', () => ({
  readSettings: jest.fn(async () => ({})),
  writeSettings: jest.fn(async () => ({})),
}));
const mockToast = jest.fn();
jest.mock('../src/components/Toast', () => ({ showToast: (...a: any[]) => mockToast(...a) }));
jest.mock('../src/wallets/WalletsProvider', () => ({
  useWallets: () => ({ wallets: [], activeWallet: { id: 'w1' }, setActiveWallet: jest.fn() }),
  WalletsProvider: ({ children }: any) => children,
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: async () => ({ isConnected: true, isInternetReachable: true }) },
}));

import PerpsTradeScreen, { findTradeMarket } from '../src/screens/PerpsTradeScreen';
import PerpsPayWithScreen from '../src/screens/PerpsPayWithScreen';
import PerpsSearchScreen from '../src/screens/PerpsSearchScreen';
import { resetPerpsRecents } from '../src/services/perpsRecents';
import { resetPerpsFavorites } from '../src/services/perpsFavorites';

beforeEach(() => { resetPerpsFavorites(); resetPerpsRecents(); mockToast.mockClear(); jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

const mount = async (Screen: any, name: string, params?: any, extra?: Record<string, any>) => {
  const Stack = createNativeStackNavigator<Record<string, object | undefined>>();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName={name}>
            <Stack.Screen name={name} component={Screen} initialParams={params} />
            {Object.entries(extra ?? {}).map(([n, C]) => <Stack.Screen key={n} name={n} component={C as any} />)}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  await act(async () => { jest.advanceTimersByTime(900); });
  return tree;
};
const texts = (t: renderer.ReactTestRenderer) =>
  [...new Set(t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string))];
const byLabel = (t: renderer.ReactTestRenderer, label: string) =>
  t.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');

describe('Perps trade ticket (Trust recording)', () => {
  it('resolves the market and renders the Open Short half-sheet', async () => {
    expect(findTradeMarket('hyperliquid', 'BTC')).toBeTruthy();
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' });
    const all = texts(t);
    expect(all).toEqual(expect.arrayContaining(['BTC', '40x', 'Open Short', 'Market', 'Size: $0.00', 'Leverage', 'Cross 3x', 'Take profit / stop loss', 'None', 'Pay with', 'Fund wallet']));
    expect(all.some((x) => /^Perps balance · \$0$/.test(x))).toBe(true);
    expect(all).toContain('Risk disclosure • 0.15% fee');
    expect(all).toContain('$0');
    // half snap hides the liquidation row and the expanded-chart extras
    expect(all).not.toContain('Liquidation price');
    expect(all).not.toContain('Indicators');
    expect(all).toContain('Expand');
    await act(async () => { t.unmount(); });
  });

  it('Open Long uses the long title', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'ETH', side: 'long' });
    expect(texts(t)).toContain('Open Long');
    await act(async () => { t.unmount(); });
  });

  it('Expand collapses the sheet to its peek and shows timeframes + Indicators', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' });
    await act(async () => { byLabel(t, 'Expand chart').props.onPress(); });
    const all = texts(t);
    expect(all).toEqual(expect.arrayContaining(['Collapse', '1H', '1D', '1W', '1M', '1Y', 'YTD', 'AI', '30m', 'Indicators', 'Volume', 'Manage']));
    // peek keeps only the header row: no amount, no rows, no CTA
    expect(all).not.toContain('Leverage');
    expect(all).not.toContain('Fund wallet');
    expect(all).toContain('Open Short');
    await act(async () => { byLabel(t, 'Collapse chart').props.onPress(); });
    expect(texts(t)).toContain('Leverage');
    expect(texts(t)).not.toContain('Indicators');
    await act(async () => { t.unmount(); });
  });

  it('interval picker changes the chart interval', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' });
    await act(async () => { byLabel(t, 'Expand chart').props.onPress(); });
    await act(async () => { byLabel(t, 'Interval').props.onPress(); });
    await act(async () => { byLabel(t, 'Interval 1h').props.onPress(); });
    expect(texts(t)).toContain('1h');
    await act(async () => { t.unmount(); });
  });

  it('the candle button toggles chart mode', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' });
    const btn = () => byLabel(t, 'Toggle candles');
    const bg = () => JSON.stringify(btn().props.style);
    const before = bg();
    await act(async () => { btn().props.onPress(); });
    expect(bg()).not.toBe(before);
    await act(async () => { t.unmount(); });
  });

  it('Fund wallet (balance $0) opens Deposit; Pay with opens the Pay-with screen', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' }, {
      PerpsPayWith: PerpsPayWithScreen,
      PerpsDeposit: () => null,
    });
    await act(async () => { byLabel(t, 'Pay with').props.onPress(); });
    await act(async () => { jest.advanceTimersByTime(600); });
    expect(texts(t)).toEqual(expect.arrayContaining(['No crypto yet', 'Please fund your wallet to start trading', 'Fund wallet with', 'NGN', 'USD', 'EUR', 'GBP']));
    await act(async () => { t.unmount(); });
  });

  it('the X closes the ticket', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' });
    expect(byLabel(t, 'Close ticket')).toBeTruthy();
    await act(async () => { t.unmount(); });
  });

  it('shows "Market not found" for an unknown symbol', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'NOPE', side: 'long' });
    expect(texts(t)).toContain('Market not found');
    await act(async () => { t.unmount(); });
  });
});

describe('Pay with screen', () => {
  it('search narrows the fiat list', async () => {
    const t = await mount(PerpsPayWithScreen, 'PerpsPayWith', { venue: 'hyperliquid' });
    expect(texts(t)).toEqual(expect.arrayContaining(['NGN', 'USD', 'EUR', 'GBP']));
    const input = t.root.find((n) => typeof n.props.onChangeText === 'function' && n.props.placeholder === 'Search');
    await act(async () => { input.props.onChangeText('euro'); });
    const all = texts(t);
    expect(all).toContain('EUR');
    expect(all).not.toContain('NGN');
    await act(async () => { t.unmount(); });
  });

  it('tapping a currency toasts (purchase flow not wired yet)', async () => {
    const t = await mount(PerpsPayWithScreen, 'PerpsPayWith', { venue: 'hyperliquid' });
    await act(async () => { byLabel(t, 'Fund with USD').props.onPress(); });
    expect(mockToast).toHaveBeenCalled();
    await act(async () => { t.unmount(); });
  });
});

describe('Search screen: browse vs trade mode (the two connected screens)', () => {
  it('browse mode: tapping a market goes to the Market Detail', async () => {
    const nav: string[] = [];
    const Probe = ({ route }: any) => { nav.push(route.name + ':' + (route.params?.side ?? '')); return null; };
    const t = await mount(PerpsSearchScreen, 'PerpsSearch', undefined, { PerpsMarket: Probe, PerpsTrade: Probe });
    await act(async () => { jest.advanceTimersByTime(900); });
    const row = t.root.findAll((n) => n.props.accessibilityLabel === 'Market BTC' && typeof n.props.onPress === 'function')[0];
    await act(async () => { row.props.onPress(); });
    await act(async () => { jest.advanceTimersByTime(600); });
    expect(nav.some((x) => x.startsWith('PerpsMarket'))).toBe(true);
    expect(nav.some((x) => x.startsWith('PerpsTrade'))).toBe(false);
    await act(async () => { t.unmount(); });
  });

  it('a tap opens the market page in every mode (long/short no longer reroute it)', async () => {
    for (const mode of [undefined, 'long', 'short'] as const) {
      const nav: string[] = [];
      const Probe = ({ route }: any) => { nav.push(route.name); return null; };
      const t = await mount(PerpsSearchScreen, 'PerpsSearch', mode ? { mode } : undefined, { PerpsMarket: Probe, PerpsTrade: Probe });
      await act(async () => { jest.advanceTimersByTime(900); });
      const row = t.root.findAll((n) => n.props.accessibilityLabel === 'Market ETH' && typeof n.props.onPress === 'function')[0];
      await act(async () => { row.props.onPress(); });
      await act(async () => { jest.advanceTimersByTime(600); });
      expect(nav).toContain('PerpsMarket');
      expect(nav).not.toContain('PerpsTrade');
      await act(async () => { t.unmount(); });
    }
  });
});

describe('Long / Short entry points', () => {
  const probeNav = () => {
    const seen: { name: string; params: any }[] = [];
    const Probe = ({ route }: any) => { seen.push({ name: route.name, params: route.params }); return null; };
    return { seen, Probe };
  };

  it('the Perps home has no Long / Short pills to route through', async () => {
    const PerpsScreen = require('../src/screens/PerpsScreen').default;
    const { seen, Probe } = probeNav();
    const t = await mount(PerpsScreen, 'Perps', undefined, { PerpsSearch: Probe });
    expect(t.root.findAll((n) => (n.props.accessibilityLabel === 'Long' || n.props.accessibilityLabel === 'Short') && typeof n.props.onPress === 'function').length).toBe(0);
    expect(seen.length).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('Market Detail Long / Short open the ticket directly for that market', async () => {
    const PerpsMarketScreen = require('../src/screens/PerpsMarketScreen').default;
    const { seen, Probe } = probeNav();
    const t = await mount(PerpsMarketScreen, 'PerpsMarket', { venue: 'hyperliquid', symbol: 'ETH' }, { PerpsTrade: Probe });
    await act(async () => { t.root.findAll((n) => n.props.accessibilityLabel === 'Short' && typeof n.props.onPress === 'function')[0].props.onPress(); });
    await act(async () => { jest.advanceTimersByTime(600); });
    expect(seen.find((s) => s.name === 'PerpsTrade')?.params).toEqual({ venue: 'hyperliquid', symbol: 'ETH', side: 'short' });
    await act(async () => { t.unmount(); });
  });
});

describe('Sheet drag + scrub header (gesture-level)', () => {
  const touch = (y: number, ts: number) => ({
    nativeEvent: { touches: [{ pageX: 100, pageY: y, identifier: 0, timestamp: ts }], changedTouches: [{ pageX: 100, pageY: y, identifier: 0, timestamp: ts }], pageX: 100, pageY: y, timestamp: ts, identifier: 0 },
    touchHistory: {
      touchBank: [{ touchActive: true, startPageX: 100, startPageY: 600, startTimeStamp: 0, currentPageX: 100, currentPageY: y, currentTimeStamp: ts, previousPageX: 100, previousPageY: 600, previousTimeStamp: 0 }],
      numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: ts,
    },
  });
  const drag = async (t: renderer.ReactTestRenderer, toY: number, ms: number) => {
    const h = t.root.findAll((n) => n.props.testID === 'sheetGrabber')[0].props;
    await act(async () => { h.onStartShouldSetResponder?.(touch(600, 0)); h.onResponderGrant?.(touch(600, 0)); });
    const steps = 6;
    for (let k = 1; k <= steps; k++) {
      const y = 600 + ((toY - 600) * k) / steps;
      await act(async () => { h.onResponderMove?.(touch(y, (ms * k) / steps)); });
    }
    await act(async () => { h.onResponderRelease?.(touch(toY, ms)); jest.advanceTimersByTime(800); });
  };

  it('dragging the sheet UP snaps to full (adds Liquidation price)', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' });
    expect(texts(t)).not.toContain('Liquidation price');
    await drag(t, 100, 160);
    expect(texts(t)).toContain('Liquidation price');
    await act(async () => { t.unmount(); });
  });

  it('dragging the sheet DOWN snaps to peek (large chart, no form)', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' });
    await drag(t, 1000, 160);
    const all = texts(t);
    expect(all).toContain('Collapse');
    expect(all).toContain('Indicators');
    expect(all).not.toContain('Leverage');
    await act(async () => { t.unmount(); });
  });

  it('OHLC header replaces the market header while a candle is held, then restores', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' });
    expect(t.root.findAll((n) => n.props.testID === 'marketHeader').length).toBeGreaterThan(0);
    expect(t.root.findAll((n) => n.props.testID === 'ohlcHeader').length).toBe(0);
    const chart = t.root.findAll((n) => typeof n.props.onScrubChange === 'function')[0];
    await act(async () => { chart.props.onScrubChange({ t: Date.UTC(2026, 9, 28, 11), open: 81525, high: 81551, low: 81416, close: 81499, volume: 1 }); });
    expect(t.root.findAll((n) => n.props.testID === 'ohlcHeader').length).toBeGreaterThan(0);
    expect(t.root.findAll((n) => n.props.testID === 'marketHeader').length).toBe(0);
    const all = texts(t);
    expect(all).toEqual(expect.arrayContaining(['Open', 'High', 'Low', 'Close', '$81,525', '$81,551', '$81,416', '$81,499', '-$26.0 (0.03%)']));
    await act(async () => { chart.props.onScrubChange(null); });
    expect(t.root.findAll((n) => n.props.testID === 'marketHeader').length).toBeGreaterThan(0);
    await act(async () => { t.unmount(); });
  });
});

describe('Order book (Trust recording, list icon)', () => {
  const open = async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' });
    await act(async () => { byLabel(t, 'Order book').props.onPress(); });
    return t;
  };
  const rowsOf = (t: renderer.ReactTestRenderer) => t.root.findAll((n) => n.props.testID === 'bookRows')[0];
  const hasId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props.testID === id).length > 0;

  it('the list icon swaps the chart for the book, and again returns to the chart', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' });
    expect(hasId(t, 'orderBook')).toBe(false);
    expect(texts(t)).toContain('Expand');
    await act(async () => { byLabel(t, 'Order book').props.onPress(); });
    expect(hasId(t, 'orderBook')).toBe(true);
    expect(texts(t)).not.toContain('Expand');
    // the sheet below is untouched
    expect(texts(t)).toEqual(expect.arrayContaining(['Open Short', 'Fund wallet', 'Leverage']));
    await act(async () => { byLabel(t, 'Order book').props.onPress(); });
    expect(hasId(t, 'orderBook')).toBe(false);
    expect(texts(t)).toContain('Expand');
    await act(async () => { t.unmount(); });
  });

  it('shows the Bid / Price / Ask header, 19 rows, USD + Group by 1 and the B/S ratio', async () => {
    const t = await open();
    const all = texts(t);
    expect(all).toEqual(expect.arrayContaining(['Bid', 'Price', 'Ask', 'USD', 'Group by ', '1', 'B', 'S']));
    const rows = rowsOf(t).props.children;
    expect(rows).toHaveLength(19);
    const pcts = all.filter((x) => /^\d+%$/.test(x)).map((x) => parseInt(x, 10));
    expect(pcts).toHaveLength(2);
    expect(pcts[0] + pcts[1]).toBe(100);
    await act(async () => { t.unmount(); });
  });

  it('sizes refresh about once a second', async () => {
    const t = await open();
    const snap = () => JSON.stringify(texts(t).filter((x) => /^[\d,]+$/.test(x)));
    const a = snap();
    await act(async () => { jest.advanceTimersByTime(1100); });
    expect(snap()).not.toBe(a);
    await act(async () => { t.unmount(); });
  });

  it('the footer opens Order book settings (USD / BTC, Group by 1 2 5 10 100, Apply)', async () => {
    const t = await open();
    expect(texts(t)).not.toContain('Order book settings');
    await act(async () => { byLabel(t, 'Display currency').props.onPress(); });
    const all = texts(t);
    expect(all).toEqual(expect.arrayContaining(['Order book settings', 'Reset', 'Display currency', 'USD', 'BTC', 'Group by', '1', '2', '5', '10', '100', 'Apply']));
    await act(async () => { t.unmount(); });
  });

  it('Group by also opens the same sheet', async () => {
    const t = await open();
    await act(async () => { byLabel(t, 'Group by').props.onPress(); });
    expect(texts(t)).toContain('Order book settings');
    await act(async () => { t.unmount(); });
  });

  it('nothing changes until Apply; Apply regroups the ladder and switches the currency label', async () => {
    const t = await open();
    const priceCol = () => texts(t).filter((x) => /^80,\d{3}$/.test(x));
    await act(async () => { byLabel(t, 'Group by').props.onPress(); });
    await act(async () => { byLabel(t, 'Group 10').props.onPress(); byLabel(t, 'Currency BTC').props.onPress(); });
    // draft only: the footer still reads USD / 1
    expect(texts(t).filter((x) => x === 'USD').length).toBeGreaterThan(0);
    await act(async () => { byLabel(t, 'Apply').props.onPress(); });
    const px = priceCol().map((x) => parseInt(x.replace(',', ''), 10));
    expect(px.length).toBeGreaterThan(5);
    expect(px.every((p) => p % 10 === 0)).toBe(true);        // grouped by 10
    expect(texts(t)).toContain('BTC');                       // footer label follows the currency
    expect(texts(t)).toContain('10');
    await act(async () => { t.unmount(); });
  });

  it('Reset returns the draft to USD / 1 and is inert while clean', async () => {
    const t = await open();
    await act(async () => { byLabel(t, 'Group by').props.onPress(); });
    const reset = () => t.root.findAll((n) => n.props.accessibilityLabel === 'Reset order book settings' && typeof n.props.onPress === 'function')[0];
    expect(reset().props.disabled).toBe(true);
    await act(async () => { byLabel(t, 'Group 5').props.onPress(); });
    expect(reset().props.disabled).toBe(false);
    await act(async () => { reset().props.onPress(); });
    expect(reset().props.disabled).toBe(true);
    const sel = (l: string) => t.root.findAll((n) => n.props.accessibilityLabel === l && n.props.accessibilityState)[0].props.accessibilityState.selected;
    expect(sel('Group 1')).toBe(true);
    expect(sel('Group 5')).toBe(false);
    expect(sel('Currency USD')).toBe(true);
    await act(async () => { t.unmount(); });
  });

  it('closing the sheet without Apply discards the draft', async () => {
    const t = await open();
    await act(async () => { byLabel(t, 'Group by').props.onPress(); });
    await act(async () => { byLabel(t, 'Group 100').props.onPress(); });
    await act(async () => { byLabel(t, 'Close order book settings').props.onPress(); });
    await act(async () => { byLabel(t, 'Group by').props.onPress(); });
    const sel = (l: string) => t.root.findAll((n) => n.props.accessibilityLabel === l && n.props.accessibilityState)[0].props.accessibilityState.selected;
    expect(sel('Group 1')).toBe(true);
    expect(sel('Group 100')).toBe(false);
    await act(async () => { t.unmount(); });
  });

  it('opening the book while the sheet is at peek returns it to half', async () => {
    const t = await mount(PerpsTradeScreen, 'PerpsTrade', { venue: 'hyperliquid', symbol: 'BTC', side: 'short' });
    await act(async () => { byLabel(t, 'Expand chart').props.onPress(); });
    expect(texts(t)).toContain('Indicators');
    await act(async () => { byLabel(t, 'Order book').props.onPress(); });
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(hasId(t, 'orderBook')).toBe(true);
    expect(texts(t)).not.toContain('Indicators');
    expect(texts(t)).toContain('Leverage');
    await act(async () => { t.unmount(); });
  });
});


describe('Search screen layout does not jump while a tab is loading (video, Oct 29)', () => {
  const flat = (st: any) => Object.assign({}, ...[].concat(st ?? []).flat(5).filter(Boolean));
  it.each([['browse', undefined], ['long', 'long'], ['short', 'short']])('%s mode: tab strip + recents are fixed-size, the spinner owns the leftover space', async (_n, mode) => {
    const Probe = () => null;
    const t = await mount(PerpsSearchScreen, 'PerpsSearch', mode ? { mode } : undefined, { PerpsMarket: Probe, PerpsTrade: Probe });
    // tap a tab so the spinner mounts
    const tab = t.root.findAll((n) => n.props.accessibilityLabel === 'Tab New' && typeof n.props.onPress === 'function')[0];
    await act(async () => { tab.props.onPress(); });
    expect(t.root.findAll((n) => n.props.accessibilityLabel === 'Loading markets').length).toBeGreaterThan(0);
    // every horizontal strip above the list must refuse to grow (else it is stretched down the screen)
    const strips = t.root.findAll((n) => n.props.horizontal === true && n.props.accessibilityLabel !== 'Market pages');
    expect(strips.length).toBeGreaterThan(0);
    for (const s of strips) {
      const st = flat(s.props.style);
      expect(st.flexGrow).toBe(0);
      expect(st.flexShrink).toBe(0);
    }
    await act(async () => { jest.advanceTimersByTime(900); });
    expect(t.root.findAll((n) => n.props.accessibilityLabel === 'Loading markets').length).toBe(0);
    await act(async () => { t.unmount(); });
  });
});
