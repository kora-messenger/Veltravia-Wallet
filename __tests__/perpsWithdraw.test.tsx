import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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

import PerpsWithdrawScreen from '../src/screens/PerpsWithdrawScreen';
import {
  depositToPerps, withdrawFromPerps, getPerpsAccount, providerBalance, resetPerpsAccounts,
} from '../src/services/perpsAccount';
import { pressKey, amountForPercent, percentForAmount, withdrawState, parseAmount } from '../src/services/perpsWithdraw';

const texts = (tree: renderer.ReactTestRenderer) =>
  tree.root
    .findAll((n) => typeof n.props.children === 'string' || (Array.isArray(n.props.children) && n.props.children.every((c: unknown) => typeof c === 'string')))
    .map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : (n.props.children as string)));

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
            <Stack.Screen name="PerpsWithdraw" component={PerpsWithdrawScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  await act(async () => { tree.root.findByType(PerpsStub).props.navigation.navigate('PerpsWithdraw'); });
  return tree;
};

const press = async (t: renderer.ReactTestRenderer, label: string) => {
  const n = t.root.find((x) => x.props.accessibilityLabel === label && typeof x.props.onPress === 'function');
  await act(async () => { n.props.onPress(); });
};
const type = async (t: renderer.ReactTestRenderer, s: string) => {
  for (const ch of s) await press(t, `Key ${ch}`);
};
const amountText = (t: renderer.ReactTestRenderer) =>
  t.root.find((x) => x.props.accessibilityLabel === 'Amount').props.children as string;
const errVisible = (t: renderer.ReactTestRenderer) =>
  t.root.find((x) => x.props.accessibilityLabel === 'Not enough balance').props.style.some?.((st: any) => st && st.opacity === 1) ?? false;
const slideEnabled = (t: renderer.ReactTestRenderer) =>
  !t.root.find((x) => x.props.accessibilityLabel === 'Slide to Withdraw').props.accessibilityState.disabled;

describe('withdraw logic', () => {
  it('keypad: no leading zeros, one dot, 2 decimals', () => {
    expect(pressKey('', '0')).toBe('0');
    expect(pressKey('0', '5')).toBe('5');
    expect(pressKey('', '.')).toBe('0.');
    expect(pressKey('1.5', '.')).toBe('1.5');
    expect(pressKey('1.25', '9')).toBe('1.25');
    expect(pressKey('12', 'back')).toBe('1');
    expect(pressKey('', 'back')).toBe('');
  });
  it('percent <-> amount', () => {
    expect(amountForPercent(200, 50)).toBe('100');
    expect(amountForPercent(0, 50)).toBe('');
    expect(amountForPercent(10.55, 100)).toBe('10.55');
    expect(percentForAmount(200, 50)).toBe(25);
    expect(percentForAmount(0, 5)).toBe(0);
  });
  it('state: empty / insufficient / ready', () => {
    expect(withdrawState(100, 0)).toBe('empty');
    expect(withdrawState(100, 100.01)).toBe('insufficient');
    expect(withdrawState(100, 100)).toBe('ready');
    expect(withdrawState(0, 1)).toBe('insufficient');
    expect(parseAmount('')).toBe(0);
  });
});

describe('per-provider balances', () => {
  beforeEach(() => resetPerpsAccounts());

  it('deposit credits Hyperliquid by default; total is the sum', () => {
    depositToPerps('w1', 100);
    depositToPerps('w1', 40, 'aster');
    expect(providerBalance('w1', 'hyperliquid')).toBe(100);
    expect(providerBalance('w1', 'aster')).toBe(40);
    expect(getPerpsAccount('w1').available).toBe(140);
  });

  it('withdraw only from the provider that holds the money', () => {
    depositToPerps('w1', 100); // Hyperliquid
    expect(withdrawFromPerps('w1', 50, 'aster')).toBe(false); // Aster has nothing
    expect(withdrawFromPerps('w1', 150, 'hyperliquid')).toBe(false); // more than it holds
    expect(withdrawFromPerps('w1', 60, 'hyperliquid')).toBe(true);
    expect(providerBalance('w1', 'hyperliquid')).toBe(40);
    expect(getPerpsAccount('w1').available).toBe(40);
  });
});

describe('Withdraw sheet', () => {
  beforeEach(() => resetPerpsAccounts());

  it('no money: typing any amount shows "Not enough balance" and locks the slide', async () => {
    const t = await mount();
    expect(texts(t)).toContain('Withdraw');
    expect(amountText(t)).toBe('0');
    expect(errVisible(t)).toBe(false);
    await type(t, '1');
    expect(amountText(t)).toBe('1');
    expect(errVisible(t)).toBe(true);
    expect(slideEnabled(t)).toBe(false);
    await act(async () => { t.unmount(); });
  });

  it('has money at the selected provider: no error, slide unlocks; over the balance errors', async () => {
    depositToPerps('w1', 100);
    const t = await mount();
    await type(t, '50');
    expect(errVisible(t)).toBe(false);
    expect(slideEnabled(t)).toBe(true);
    await type(t, '0'); // 500 > 100
    expect(errVisible(t)).toBe(true);
    expect(slideEnabled(t)).toBe(false);
    await press(t, 'Backspace');
    expect(errVisible(t)).toBe(false);
    await act(async () => { t.unmount(); });
  });

  it('money only at Hyperliquid: switching to Aster errors, switching back works', async () => {
    depositToPerps('w1', 100); // Hyperliquid only
    const t = await mount();
    await press(t, 'Withdraw from');
    expect(texts(t)).toContain('Select provider');
    await press(t, 'Provider Aster');
    await type(t, '10');
    expect(errVisible(t)).toBe(true); // Aster holds $0
    await press(t, 'Withdraw from');
    await press(t, 'Provider Hyperliquid');
    await type(t, '10');
    expect(errVisible(t)).toBe(false);
    expect(slideEnabled(t)).toBe(true);
    await act(async () => { t.unmount(); });
  });

  it('opens on the provider that actually holds the money', async () => {
    depositToPerps('w1', 75, 'aster');
    const t = await mount();
    expect(texts(t)).toContain('Aster');
    expect(texts(t)).toContain('75.00 USDC');
    await act(async () => { t.unmount(); });
  });

  it('Receive opens Select network and picking one updates the row', async () => {
    const t = await mount();
    expect(texts(t)).toContain('Arbitrum');
    await press(t, 'Receive');
    expect(texts(t)).toContain('Select network');
    await press(t, 'Network Base');
    expect(texts(t)).toContain('Base');
    expect(texts(t)).not.toContain('Select network');
    await act(async () => { t.unmount(); });
  });
});
