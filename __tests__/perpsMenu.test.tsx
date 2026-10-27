import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Linking } from 'react-native';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', background: '#FFFFFF' } }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));

const mockInApp = jest.fn(() => true);
jest.mock('../src/services/browserState', () => ({
  ...jest.requireActual('../src/services/browserState'),
  openInBrowser: (...a: unknown[]) => (mockInApp as any)(...a),
}));

import PerpsMenuScreen, { SUPPORT_URL } from '../src/screens/PerpsMenuScreen';

const mount = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer><PerpsMenuScreen /></NavigationContainer>
      </SafeAreaProvider>,
    );
  });
  return tree;
};
const labels = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);

describe('Settings > Perps menu', () => {
  let openURL: jest.SpyInstance;
  beforeEach(() => {
    mockInApp.mockClear();
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
  });
  afterEach(() => openURL.mockRestore());

  it('shows the four Trust rows in order', async () => {
    const t = await mount();
    const l = labels(t);
    const order = ['Perps', 'Hyperliquid', 'Aster', 'How perps work?', 'Contact support'].map((x) => l.indexOf(x));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    await act(async () => { t.unmount(); });
  });

  it('Contact support goes to the system browser, NOT the in-app browser', async () => {
    const t = await mount();
    const row = t.root.findAll((n) => n.props.accessibilityRole === 'button' && n.findAll((c) => c.props.children === 'Contact support').length > 0)[0];
    await act(async () => { row.props.onPress(); });
    expect(openURL).toHaveBeenCalledWith('https://help.veltraviawallet.com');
    expect(mockInApp).not.toHaveBeenCalled();
    await act(async () => { t.unmount(); });
  });

  it('support URL is https on the veltraviawallet.com domain', () => {
    expect(SUPPORT_URL).toBe('https://help.veltraviawallet.com');
  });
});
