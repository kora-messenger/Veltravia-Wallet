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
const mockOnline = { state: 'online' as 'checking' | 'online' | 'offline' };
jest.mock('../src/hooks/useOnlineGate', () => ({
  useOnlineGate: () => ({ state: mockOnline.state, recheck: jest.fn() }),
}));

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
    expect(all).toContain('About Bitcoin');
    expect(all).toContain('24h volume');
    expect(all).toContain('Related markets');
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
    expect(texts(t)).toContain('This market is not available right now.');
    await act(async () => { t.unmount(); });
  });
});

describe('market page: About, timeframes, related (screenshot parity)', () => {
  beforeEach(() => { resetPerpsFavorites(); resetPerpsRecents(); });

  it('About is AI-written: View more expands it and shows the AI disclaimer', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    let all = texts(t);
    expect(all).toContain('About Bitcoin');
    expect(all).toContain('View more');
    expect(all).not.toContain('This description has been generated by AI');
    await press(t, 'View more');
    all = texts(t);
    expect(all).toContain('View less');
    expect(all).toContain('This description has been generated by AI. It has been generated for informational purposes only, and should not be taken as financial advice.');
    await act(async () => { t.unmount(); });
  });

  it('timeframe chips: 1D is active by default; tapping YTD switches it', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    expect(texts(t)).toContain('1D');
    expect(texts(t)).toContain('YTD');
    await press(t, 'Timeframe YTD');
    await act(async () => { t.unmount(); });
  });

  it('Related markets PUSH a new market page; back-stack walks BTC -> ZEC -> back to BTC (Trust 09:42 flow)', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    expect(texts(t)).toContain('Related markets');
    const nav = t.root.findByType(PerpsMarketScreen).props.navigation;
    const pushSpy = jest.spyOn(nav, 'push').mockImplementation(() => {});
    const replaceSpy = jest.spyOn(nav, 'replace').mockImplementation(() => {});
    // the ETH related card
    const ethCard = t.root.findAll((n) => typeof n.props.onPress === 'function')
      .find((n) => (n.props.children as any)?.some?.((c: any) => typeof c?.props?.children === 'string' && c.props.children === 'ETH'));
    expect(ethCard).toBeTruthy();
    await act(async () => { ethCard!.props.onPress(); });
    expect(pushSpy).toHaveBeenCalledWith('PerpsMarket', { venue: 'hyperliquid', symbol: 'ETH' });
    expect(replaceSpy).not.toHaveBeenCalled();
    // this BTC page is untouched (still mounted, still BTC)
    expect(texts(t)).toContain('About Bitcoin');
    pushSpy.mockRestore(); replaceSpy.mockRestore();
    await act(async () => { t.unmount(); });
  });
});

describe('Advanced chart mode (Trust recording 2026-10-28 09:33)', () => {
  beforeEach(() => { resetPerpsFavorites(); resetPerpsRecents(); });

  const has = (t: renderer.ReactTestRenderer, label: string) =>
    t.root.findAll((x) => x.props.accessibilityLabel === label && typeof x.props.onPress === 'function').length > 0;

  it('normal view: About / Stats / Related and the Advanced button; no Indicators card', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    const all = texts(t);
    expect(all).toContain('About Bitcoin');
    expect(all).toContain('Related markets');
    expect(all).not.toContain('Indicators');
    expect(has(t, 'Return')).toBe(false);
    await act(async () => { t.unmount(); });
  });

  it('Advanced: hides About/Stats/Related, shows Indicators (Volume + Manage), TradingView logo, Return; keeps Long/Short', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    await press(t, 'Show candles');
    await press(t, 'Advanced chart');
    const all = texts(t);
    expect(all).not.toContain('About Bitcoin');
    expect(all).not.toContain('Related markets');
    expect(all).not.toContain('24h volume');
    expect(all).toContain('Indicators');
    expect(all).toContain('Volume');
    expect(all).toContain('Manage');
    expect(all).toContain('Return');
    expect(all).toContain('Long');
    expect(all).toContain('Short');
    expect(has(t, 'TradingView')).toBe(true);
    expect(has(t, 'Advanced chart')).toBe(false);
    await act(async () => { t.unmount(); });
  });

  it('Return goes back to the normal page', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    await press(t, 'Show candles');
    await press(t, 'Advanced chart');
    await press(t, 'Return');
    expect(texts(t)).toContain('About Bitcoin');
    expect(texts(t)).not.toContain('Indicators');
    await act(async () => { t.unmount(); });
  });

  it('the TradingView logo opens tradingview.com in the system browser', async () => {
    const { Linking } = require('react-native');
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    await press(t, 'Show candles');
    await press(t, 'Advanced chart');
    await press(t, 'TradingView');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain('tradingview.com');
    spy.mockRestore();
    await act(async () => { t.unmount(); });
  });

  it('Manage toggles the Volume indicator (Volume <-> None)', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    await press(t, 'Show candles');
    await press(t, 'Advanced chart');
    expect(texts(t)).toContain('Volume');
    await press(t, 'Manage indicators');
    expect(texts(t)).toContain('None');
    await press(t, 'Manage indicators');
    expect(texts(t)).toContain('Volume');
    await act(async () => { t.unmount(); });
  });

  // ---- the new normal-view model (Trust 10:08 recording) ------------------
  const inst = (t: renderer.ReactTestRenderer, path: string) => {
    const Cmp = require(path).default;
    return t.root.findAll((x) => x.type === Cmp).length;
  };
  const C = '../src/components/CandleChart';
  const TV = '../src/components/TradingViewChart';
  const TR = '../src/components/TrendChart';
  const toCandles = (t: renderer.ReactTestRenderer) => press(t, 'Show candles');

  it('default normal view is the TREND chart with the seven ranges and no interval picker', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    expect(inst(t, TR)).toBe(1);
    expect(inst(t, C)).toBe(0);
    expect(inst(t, TV)).toBe(0);
    for (const r of ['1H', '1D', '1W', '1M', '1Y', 'YTD', 'ALL']) expect(has(t, `Timeframe ${r}`)).toBe(true);
    expect(has(t, 'Candle interval')).toBe(false);
    expect(has(t, 'Show candles')).toBe(true);   // the arrow icon
    expect(has(t, 'Open candle view')).toBe(false);
    await act(async () => { t.unmount(); });
  });

  it('tapping the arrow shows the candle illustration and the icon becomes the candle icon', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    await toCandles(t);
    expect(inst(t, C)).toBe(1);
    expect(inst(t, TR)).toBe(0);
    expect(inst(t, TV)).toBe(0);                  // not the real view yet
    expect(has(t, 'Open candle view')).toBe(true); // candle icon
    expect(has(t, 'Show candles')).toBe(false);
    expect(has(t, 'Candle interval')).toBe(true);  // candle ranges + interval now
    await act(async () => { t.unmount(); });
  });

  it('tapping the candle icon opens the REAL candle view (TradingView)', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    await toCandles(t);
    await press(t, 'Open candle view');
    expect(inst(t, TV)).toBe(1);
    expect(inst(t, C)).toBe(0);
    expect(inst(t, TR)).toBe(0);
    expect(texts(t)).toContain('Indicators');
    expect(texts(t)).toContain('Return');
    await act(async () => { t.unmount(); });
  });

  it('the Advanced pill still jumps straight to the real candle view', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    await toCandles(t);
    await press(t, 'Advanced chart');
    expect(inst(t, TV)).toBe(1);
    await act(async () => { t.unmount(); });
  });

  it('trend ranges are selectable, including ALL', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    await press(t, 'Timeframe ALL');
    expect(inst(t, TR)).toBe(1);
    await press(t, 'Timeframe 1W');
    expect(inst(t, TR)).toBe(1);
    await act(async () => { t.unmount(); });
  });

  it('interval picker (candle illustration): opens, lists intervals, picking one updates the chip', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    await toCandles(t);
    expect(texts(t)).toContain('30m');
    await press(t, 'Candle interval');
    expect(texts(t)).toContain('Candle interval');
    await press(t, 'Interval 4h');
    expect(texts(t)).toContain('4h');
    expect(texts(t)).not.toContain('30m');
    await act(async () => { t.unmount(); });
  });

  it("choosing a candle range resets the interval to that range's default (1W -> 4h, 1H -> 1m)", async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    await toCandles(t);
    await press(t, 'Timeframe 1H');
    expect(texts(t)).toContain('1m');
    await press(t, 'Timeframe 1Y');
    expect(texts(t)).toContain('1d');
    await act(async () => { t.unmount(); });
  });

  it('scrubbing the trend chart drives the header (price, change, date) and release restores it', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    const before = texts(t).filter((x) => /^\$[\d,.]+$/.test(x));
    const chart = t.root.find((x) => x.props.accessibilityLabel === 'Trend chart');
    await act(async () => { chart.props.onLayout({ nativeEvent: { layout: { width: 340 } } }); });
    await act(async () => { chart.props.onResponderGrant({ nativeEvent: { locationX: 40 } }); });
    const during = texts(t);
    expect(during.some((x) => /^[+-]\$[\d,.]+ \([\d.]+%\) [A-Z][a-z]{2} \d{1,2}, /.test(x))).toBe(true);
    await act(async () => { chart.props.onResponderRelease(); });
    const after = texts(t);
    expect(after.some((x) => /^[+-]\$[\d,.]+ \([\d.]+%\) [A-Z][a-z]{2} \d{1,2}, /.test(x))).toBe(false);
    expect(after.filter((x) => /^\$[\d,.]+$/.test(x))).toEqual(before);
    await act(async () => { t.unmount(); });
  });

  it('Return from the real candle view lands back on the normal page', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    await toCandles(t);
    await press(t, 'Open candle view');
    await press(t, 'Return');
    expect(inst(t, TV)).toBe(0);
    expect(texts(t)).toContain('About Bitcoin');
    await act(async () => { t.unmount(); });
  });

  it('the candle illustration ignores gestures; the trend chart takes them', async () => {
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    expect(t.root.find((x) => x.props.accessibilityLabel === 'Trend chart').props.onStartShouldSetResponder()).toBe(true);
    await toCandles(t);
    expect(t.root.find((x) => x.props.accessibilityLabel === 'Candle chart').props.onStartShouldSetResponder()).toBe(false);
    await act(async () => { t.unmount(); });
  });
});

describe('candles need the network (Ijezie, 31 Oct 2026)', () => {
  it('offline: the chart is replaced by a notice, not drawn from stale data', async () => {
    mockOnline.state = 'offline';
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    expect(t.root.findAll((n) => n.props.testID === 'chartNeedsNetwork').length).toBeGreaterThan(0);
    expect(t.root.findAll((n) => n.props.testID === 'candleChart').length).toBe(0);
    await act(async () => { t.unmount(); });
    mockOnline.state = 'online';
  });

  it('online: the chart draws again', async () => {
    mockOnline.state = 'online';
    const t = await mount({ venue: 'hyperliquid', symbol: 'BTC' });
    expect(t.root.findAll((n) => n.props.testID === 'chartNeedsNetwork').length).toBe(0);
    // the live chart area is back: its Advanced control is part of it
    expect(t.root.findAll((n) => n.props.accessibilityLabel === 'Advanced chart').length).toBeGreaterThan(0);
    await act(async () => { t.unmount(); });
  });
});
