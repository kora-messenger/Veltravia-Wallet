/**
 * Activity screen: reloading shows the shimmer skeleton and NOTHING else.
 * (Ijezie, 31 Oct 2026: "when user refresh I don't need that line loading;
 * the skeleton loading we have is what we use".) No sweeping gradient bar, no
 * native pull spinner.
 */
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

let mockOnline = false;
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: async () => ({ isConnected: mockOnline, isInternetReachable: mockOnline }) },
}));

import ActivityScreen from '../src/screens/ActivityScreen';
import { ActivitySkeleton } from '../src/components/Skeleton';
import { PULL_THRESHOLD } from '../src/hooks/usePullToReload';

beforeEach(() => { mockOnline = false; jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

const mount = async () => {
  const Stack = createNativeStackNavigator<Record<string, object | undefined>>();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Activity">
            <Stack.Screen name="Activity" component={ActivityScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  await act(async () => { jest.advanceTimersByTime(1200); }); // first load settles (offline -> error view)
  return tree;
};

const texts = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
const skeletons = (t: renderer.ReactTestRenderer) => t.root.findAll((n) => n.type === ActivitySkeleton).length;
/** The Pressable whose subtree contains the "Reload" label. */
const reloadBtn = (t: renderer.ReactTestRenderer) => {
  const label = t.root.findAll((n) => n.props.children === 'Reload')[0];
  let cur: any = label;
  while (cur && typeof cur.props.onPress !== 'function') cur = cur.parent;
  return cur;
};

describe('Activity reload uses the skeleton, not a line or a spinner', () => {
  it('offline load lands on the failure view', async () => {
    const t = await mount();
    expect(texts(t)).toContain('Something went wrong');
    expect(skeletons(t)).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('Reload: the skeleton replaces the failure view while it runs, then the result returns', async () => {
    const t = await mount();
    await act(async () => { reloadBtn(t).props.onPress(); });
    expect(skeletons(t)).toBeGreaterThanOrEqual(1);
    expect(texts(t)).not.toContain('Something went wrong');
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(texts(t)).toContain('Something went wrong'); // still offline
    expect(skeletons(t)).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('no gradient bar is ever drawn', async () => {
    const t = await mount();
    await act(async () => { reloadBtn(t).props.onPress(); });
    const LinearGradient = require('react-native-linear-gradient').default;
    expect(t.root.findAll((n) => n.type === LinearGradient).length).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('no native RefreshControl exists to draw a spinner', async () => {
    const t = await mount();
    expect(t.root.findAll((n) => typeof n.props.onRefresh === 'function').length).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('pulling past the threshold and releasing reloads through the skeleton', async () => {
    const t = await mount();
    const scroller = t.root.findAll((n) => typeof n.props.onScrollEndDrag === 'function')[0];
    await act(async () => {
      scroller.props.onScroll({ nativeEvent: { contentOffset: { y: -(PULL_THRESHOLD + 10) } } });
      scroller.props.onScrollEndDrag();
    });
    expect(skeletons(t)).toBeGreaterThanOrEqual(1);
    await act(async () => { jest.advanceTimersByTime(2000); });
    await act(async () => { t.unmount(); });
  });

  it('a short tug does nothing', async () => {
    const t = await mount();
    const scroller = t.root.findAll((n) => typeof n.props.onScrollEndDrag === 'function')[0];
    await act(async () => {
      scroller.props.onScroll({ nativeEvent: { contentOffset: { y: -(PULL_THRESHOLD - 20) } } });
      scroller.props.onScrollEndDrag();
    });
    expect(skeletons(t)).toBe(0);
    expect(texts(t)).toContain('Something went wrong');
    await act(async () => { t.unmount(); });
  });
});
