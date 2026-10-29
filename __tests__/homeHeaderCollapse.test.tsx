import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: require('../src/theme/tokens').themes.light }),
}));
jest.mock('../src/core/storage/secureStorage', () => ({ readSettings: jest.fn(async () => ({})), writeSettings: jest.fn(async () => ({})) }));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));
jest.mock('../src/wallets/WalletsProvider', () => ({
  useWallets: () => ({
    wallets: [],
    activeWallet: { id: 'w1', name: 'Veltravia Wallet', icon: 'shield', color: '#6C63FF', backedUp: false },
    setActiveWallet: jest.fn(),
  }),
  WalletsProvider: ({ children }: any) => children,
}));

import HomeScreen from '../src/screens/HomeScreen';
import { totalValue } from '../src/services/portfolio';
import { headerAmount, SWAP_START, SWAP_SPAN } from '../src/services/headerCollapse';

// Jest has no native animated module, so a native-driven Animated.event does not
// update the JS value. Run the SAME event mapping on the JS driver for the tests.
const realEvent = Animated.event;
beforeAll(() => {
  jest.useFakeTimers();
  (Animated as any).event = (mapping: any, cfg: any) => realEvent(mapping, { ...cfg, useNativeDriver: false });
});
afterAll(() => { (Animated as any).event = realEvent; jest.useRealTimers(); });

const mount = async () => {
  const Stack = createNativeStackNavigator<Record<string, object | undefined>>();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Home"><Stack.Screen name="Home" component={HomeScreen} /></Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  return tree;
};
const scrollTo = async (t: renderer.ReactTestRenderer, y: number) => {
  const sv = t.root.findAll((n) => typeof n.props.onScroll === 'function' && n.props.scrollEventThrottle === 16)[0];
  await act(async () => { sv.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y } } }); });
};
const styleOf = (t: renderer.ReactTestRenderer, id: string) => {
  const n = t.root.findAll((x) => x.props.testID === id)[0];
  const flat = Object.assign({}, ...[].concat(n.props.style ?? []).flat(5).filter(Boolean));
  const val = (v: any) => (v && typeof v.__getValue === 'function' ? v.__getValue() : v);
  return { opacity: val(flat.opacity), shift: val(flat.transform?.[0]?.translateY) };
};

describe('Home header: wallet name swaps for the balance past the balance card', () => {
  it('both texts exist; at the top the name is visible and the amount is not', async () => {
    const t = await mount();
    expect(t.root.findAll((n) => n.props.testID === 'headerName').length).toBeGreaterThan(0);
    expect(t.root.findAll((n) => n.props.testID === 'headerAmount').length).toBeGreaterThan(0);
    const n = styleOf(t, 'headerName'), a = styleOf(t, 'headerAmount');
    expect(n.opacity).toBe(1);
    expect(a.opacity).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('the header amount is the same figure as the balance card', async () => {
    const t = await mount();
    const amt = t.root.findAll((n) => n.props.testID === 'headerAmount')[0];
    const text = [].concat(amt.props.children).join('');
    expect(text).toBe(headerAmount(totalValue(), false));
    await act(async () => { t.unmount(); });
  });

  it('scrolling past the balance card: the amount appears and the name disappears', async () => {
    const t = await mount();
    await scrollTo(t, SWAP_START + SWAP_SPAN + 40);
    const n = styleOf(t, 'headerName'), a = styleOf(t, 'headerAmount');
    expect(n.opacity).toBe(0);
    expect(a.opacity).toBe(1);
    expect(a.shift).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('scrolling back to the top restores the name', async () => {
    const t = await mount();
    await scrollTo(t, 400);
    await scrollTo(t, 0);
    expect(styleOf(t, 'headerName').opacity).toBe(1);
    expect(styleOf(t, 'headerAmount').opacity).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('a small scroll (card still in view) does not change the header', async () => {
    const t = await mount();
    await scrollTo(t, 30);
    expect(styleOf(t, 'headerName').opacity).toBe(1);
    expect(styleOf(t, 'headerAmount').opacity).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('hiding the balance (eye) masks the header amount too', async () => {
    const t = await mount();
    const eye = t.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.hitSlop === 10)[0];
    await act(async () => { eye.props.onPress(); });
    const amt = t.root.findAll((n) => n.props.testID === 'headerAmount')[0];
    expect([].concat(amt.props.children).join('')).toBe('$••••••');
    await act(async () => { t.unmount(); });
  });

  it('the header stays transparent while scrolled: no full-width backing band', async () => {
    const t = await mount();
    // nothing paints a page-coloured strip behind the header, at rest or scrolled
    expect(t.root.findAll((n) => n.props.testID === 'headerStrip').length).toBe(0);
    await scrollTo(t, 240);
    expect(t.root.findAll((n) => n.props.testID === 'headerStrip').length).toBe(0);
    // the balance pill keeps its translucent chip colour rather than an opaque page colour
    const flat = (st: any) => Object.assign({}, ...[].concat(st ?? []).flat(6).filter((v: any) => v && typeof v === 'object' && !Array.isArray(v)));
    const pills = t.root.findAll((n) => !!n.props.style && flat(typeof n.props.style === 'function' ? n.props.style({ pressed: false }) : n.props.style).borderRadius === 23);
    expect(pills.length).toBeGreaterThan(0);
    expect(String(flat(pills[0].props.style({ pressed: false })).backgroundColor)).toMatch(/rgba/);
    await act(async () => { t.unmount(); });
  });

  it('the balance still swaps into the header with no band behind it', async () => {
    const t = await mount();
    await scrollTo(t, SWAP_START + SWAP_SPAN + 40);
    expect(styleOf(t, 'headerAmount').opacity).toBe(1);
    expect(styleOf(t, 'headerName').opacity).toBe(0);
    expect(t.root.findAll((n) => n.props.testID === 'headerStrip').length).toBe(0);
    await act(async () => { t.unmount(); });
  });
});
