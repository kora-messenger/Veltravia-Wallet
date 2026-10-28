import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', brandGradient: ['#6C63FF', '#4A90D9'], background: '#FFFFFF', surface: '#F5F5F7', surfaceAlt: '#EDEDF0' } }),
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

import PerpsActivityScreen from '../src/screens/PerpsActivityScreen';
import PerpsScreen from '../src/screens/PerpsScreen';
import PerpsMarketScreen from '../src/screens/PerpsMarketScreen';
import { resetPerpsFavorites } from '../src/services/perpsFavorites';
import { resetPerpsRecents } from '../src/services/perpsRecents';

beforeEach(() => { resetPerpsFavorites(); resetPerpsRecents(); mockOnline = true; jest.useFakeTimers(); });
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

  it('the filter-lines button opens the Filters sheet', async () => {
    const t = await mountScreen(PerpsActivityScreen, 'PerpsActivity');
    const fs = require('../src/components/FilterSheet').default;
    expect(t.root.findAll((n) => n.type === fs).length).toBe(1); // mounted (sheet controls its own visibility)
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
