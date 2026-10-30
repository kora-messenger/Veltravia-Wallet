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
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));
jest.mock('../src/wallets/WalletsProvider', () => ({
  useWallets: () => ({ wallets: [], activeWallet: { id: 'w1' }, setActiveWallet: jest.fn() }),
  WalletsProvider: ({ children }: any) => children,
}));

let mockOnline = true;
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: async () => ({ isConnected: mockOnline, isInternetReachable: mockOnline }) },
}));

const mockItems: any[] = [];
jest.mock('../src/services/perpsActivity', () => ({ loadPerpsActivity: async () => mockItems }));

import PerpsActivityScreen from '../src/screens/PerpsActivityScreen';
import PerpsScreen from '../src/screens/PerpsScreen';
import PerpsMarketScreen from '../src/screens/PerpsMarketScreen';
import { resetPerpsFavorites } from '../src/services/perpsFavorites';
import { resetPerpsRecents } from '../src/services/perpsRecents';

beforeEach(() => { mockItems.length = 0; resetPerpsFavorites(); resetPerpsRecents(); mockOnline = true; jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

const mountScreen = async (Screen: any, name: string, params?: any) => {
  const Stack = createNativeStackNavigator<Record<string, object | undefined>>();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName={name}>
            <Stack.Screen name={name} component={Screen} initialParams={params} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  // advance the 900ms skeleton load so the screen settles
  await act(async () => { jest.advanceTimersByTime(1500); });
  return tree;
};
const texts = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

describe('Perps Activity screen (Trust 10:21 screenshot)', () => {
  it('empty state: robot illustration, "No activity yet", "Your transactions will appear here"', async () => {
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');
    const imgNodes = t.root.findAll((n) => n.props.source !== undefined);
    expect(imgNodes.some((n) => JSON.stringify(n.props.source).includes('no-activity-robot'))).toBe(true);
    const all = texts(t);
    expect(all).toContain('No activity yet');
    expect(all).toContain('Your transactions will appear here');
    expect(all).toContain('Activity');
    await act(async () => { t.unmount(); });
  });

  it('the "Show older activity" pill auto-hides once refresh confirms no older history', async () => {
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');
    await act(async () => { jest.advanceTimersByTime(6000); });
    expect(texts(t)).not.toContain('Show older activity');
    await act(async () => { t.unmount(); });
  });

  it('offline load: sad-robot illustration, "Failed to load activity", Retry; recovering clears it', async () => {
    mockOnline = false;
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');
    const all = texts(t);
    expect(all).toContain('Failed to load activity');
    expect(all).toContain('Retry');
    expect(all).not.toContain('Something went wrong');
    const robot = t.root.findAll((n) => JSON.stringify(n.props.source ?? '').includes('activity-error-robot'));
    expect(robot.length).toBeGreaterThanOrEqual(1);
    // back online -> Retry reloads to the empty list
    mockOnline = true;
    const btn = t.root.find((n) => n.props.children?.props?.children === 'Retry');
    await act(async () => { btn.props.onPress(); });
    await act(async () => { jest.advanceTimersByTime(1500); });
    expect(texts(t)).toContain('No activity yet');
    await act(async () => { t.unmount(); });
  });

  it('drag-down refresh: the spinner drives a skeleton search, then the list returns', async () => {
    const { ActivitySkeleton } = require('../src/components/Skeleton');
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');
    const ctl = t.root.findAll((n) => typeof n.props.onRefresh === 'function');
    expect(ctl.length).toBe(1); // the empty list's RefreshControl
    const p = ctl[0].props.onRefresh();
    await act(async () => {});  // flush NetInfo -> refreshing=true, skeleton up
    expect(t.root.findAll((n) => n.type === ActivitySkeleton).length).toBeGreaterThanOrEqual(1);
    expect(texts(t)).not.toContain('No activity yet'); // list swapped out for the search
    await act(async () => { jest.advanceTimersByTime(1300); });
    await p;
    await act(async () => {});
    expect(texts(t)).toContain('No activity yet');
    await act(async () => { t.unmount(); });
  });

  it('the filter-lines button opens the Perps "Filter" sheet (not the wallet Filters sheet)', async () => {
    const PerpsFilterSheet = require('../src/components/PerpsFilterSheet').default;
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');
    const sheet = t.root.findByType(PerpsFilterSheet);
    expect(sheet.props.visible).toBe(false);
    // the header's filter-lines button is the only other Pressable with the icon
    const btn = t.root.find((n) => typeof n.props.onPress === 'function' && Array.isArray(n.props.children) && n.props.children.some((c: any) => c?.type?.name === 'FilterLinesIcon'));
    expect(btn).toBeTruthy();
    await act(async () => { btn.props.onPress(); });
    expect(sheet.props.visible).toBe(true);
    await act(async () => { t.unmount(); });
  });
});

describe('Perps entry points route to the PERPS activity screen', () => {
  it('the Perps home round-timer icon navigates to PerpsActivity', async () => {
    const t = await mountScreen(PerpsScreen, 'Perps');
    const nav = t.root.findByType(PerpsScreen).props.navigation;
    const spy = jest.spyOn(nav, 'navigate').mockImplementation(() => {});
    const icon = t.root.find((n) => n.props.accessibilityLabel === 'Perps history');
    await act(async () => { icon.props.onPress(); });
    expect(spy).toHaveBeenCalledWith('PerpsActivity');
    spy.mockRestore();
    await act(async () => { t.unmount(); });
  });

  it('the market screen history icon navigates to PerpsActivity (not the wallet Activity)', async () => {
    const t = await mountScreen(PerpsMarketScreen, 'PerpsMarket', { venue: 'hyperliquid', symbol: 'BTC' });
    const nav = t.root.findByType(PerpsMarketScreen).props.navigation;
    const spy = jest.spyOn(nav, 'navigate').mockImplementation(() => {});
    const icon = t.root.find((n) => n.props.accessibilityLabel === 'Market history');
    await act(async () => { icon.props.onPress(); });
    expect(spy).toHaveBeenCalledWith('PerpsActivity');
    spy.mockRestore();
    await act(async () => { t.unmount(); });
  });
});

const byId = (t: renderer.ReactTestRenderer, id: string) => t.root.findAll((n) => n.props.testID === id)[0];
const tap = async (t: renderer.ReactTestRenderer, id: string) => {
  await act(async () => { await byId(t, id).props.onPress(); });
};
const openFilter = async (t: renderer.ReactTestRenderer) => {
  await act(async () => {
    t.root.find((n) => typeof n.props.onPress === 'function' && Array.isArray(n.props.children) && n.props.children.some((c: any) => c?.type?.name === 'FilterLinesIcon')).props.onPress();
  });
};
// the test renderer reports a composite and its host node per testID: count each id once
const rows = (t: renderer.ReactTestRenderer) => [...new Set(
  t.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('activity-')).map((n) => n.props.testID as string),
)].filter((id) => id !== 'activityEmptyTitle');
const dots = (t: renderer.ReactTestRenderer) => new Set(t.root.findAll((n) => n.props.testID === 'filterActiveDot')).size;

describe('Perps filter button active dot (Trust 10:44 recording: 15s mark)', () => {
  it('no dot while filters are the defaults; the dot appears once a filter is applied', async () => {
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');
    expect(dots(t)).toBe(0);
    await openFilter(t);
    await tap(t, 'chip-hyperliquid');
    await tap(t, 'showResults');
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(dots(t)).toBeGreaterThan(0);
    await act(async () => { t.unmount(); });
  });
});

describe('"Show results" really filters the Activity list', () => {
  const NOW = Date.now();
  const DAY = 86_400_000;
  const seed = () => mockItems.push(
    { id: 'btc-trade', provider: 'hyperliquid', asset: 'BTC', type: 'trade', status: 'completed', timestamp: NOW - 1 * DAY },
    { id: 'ant-order', provider: 'aster', asset: 'ANT', type: 'order', status: 'submitted', timestamp: NOW - 20 * DAY },
    { id: 'eth-xfer', provider: 'hyperliquid', asset: 'ETH', type: 'transfer', status: 'failed', timestamp: NOW - 60 * DAY },
    { id: 'btc-fund', provider: 'hyperliquid', asset: 'BTC', type: 'transfer', status: 'completed', isFunding: true, timestamp: NOW - 1 * DAY },
  );

  it('no filters: everything except funding payments', async () => {
    seed();
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');
    expect(rows(t).sort()).toEqual(['activity-ant-order', 'activity-btc-trade', 'activity-eth-xfer']);
    await act(async () => { t.unmount(); });
  });

  it('provider + status + date each narrow the list the user sees', async () => {
    seed();
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');

    await openFilter(t);
    await tap(t, 'chip-aster');
    await tap(t, 'showResults');
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(rows(t)).toEqual(['activity-ant-order']);

    await openFilter(t);
    await tap(t, 'filterReset');
    await tap(t, 'chip-failed');
    await tap(t, 'showResults');
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(rows(t)).toEqual(['activity-eth-xfer']);

    await openFilter(t);
    await tap(t, 'filterReset');
    await tap(t, 'chip-7d');
    await tap(t, 'showResults');
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(rows(t)).toEqual(['activity-btc-trade']);
    await act(async () => { t.unmount(); });
  });

  it('the funding switch reveals funding payments', async () => {
    seed();
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');
    await openFilter(t);
    await tap(t, 'fundingToggle');
    await tap(t, 'showResults');
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(rows(t)).toContain('activity-btc-fund');
    await act(async () => { t.unmount(); });
  });

  it('a filter that matches nothing says "No results" and Clear filters brings everything back', async () => {
    seed();
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');
    await openFilter(t);
    await tap(t, 'chip-aster');
    await tap(t, 'chip-failed');          // no Aster transaction failed
    await tap(t, 'showResults');
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(rows(t)).toEqual([]);
    expect(byId(t, 'activityEmptyTitle').props.children).toBe('No results');

    await tap(t, 'clearFilters');
    expect(rows(t).length).toBe(3);
    expect(dots(t)).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('with no history at all it says "No activity yet", not "No results"', async () => {
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');
    await openFilter(t);
    await tap(t, 'chip-aster');
    await tap(t, 'showResults');
    await act(async () => { jest.advanceTimersByTime(400); });
    expect(byId(t, 'activityEmptyTitle').props.children).toBe('No activity yet');
    await act(async () => { t.unmount(); });
  });
});
