import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', brandGradient: ['#6C63FF', '#4A90D9'], buttonGradient: ['#6C63FF', '#4A90D9'], background: '#FFFFFF', surface: '#F5F5F7', surfaceAlt: '#EDEDF0' } }),
}));
jest.mock('../src/core/security/appLockState', () => ({ useAppLocked: () => false }));
jest.mock('../src/wallets/WalletsProvider', () => ({
  useWallets: () => ({ wallets: [], activeWallet: { id: 'w1' }, setActiveWallet: jest.fn() }),
  WalletsProvider: ({ children }: any) => children,
}));

import PerpsFilterSheet, {
  PerpsActivityFilters, DEFAULT_PERPS_ACTIVITY_FILTERS,
} from '../src/components/PerpsFilterSheet';

const mount = async (filters: PerpsActivityFilters = DEFAULT_PERPS_ACTIVITY_FILTERS) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <PerpsFilterSheet visible filters={filters} onClose={jest.fn()} onApply={jest.fn()} />
      </SafeAreaProvider>,
    );
  });
  return tree;
};
const texts = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
const chip = (t: renderer.ReactTestRenderer, label: string) =>
  t.root.find((n) => n.props?.accessibilityRole === 'button' && Array.isArray(n.props.children) && n.props.children.some((c: any) => c?.props?.children === label));

describe('Perps "Filter" sheet (Trust 10:38 screenshot)', () => {
  it('renders every section from the screenshot', async () => {
    const t = await mount();
    const all = texts(t);
    for (const expected of [
      'Filter', 'Reset', 'Provider', 'Hyperliquid', 'Aster', 'Assets', 'Select',
      'Type', 'Order', 'Trade', 'Transfer', 'Show funding payment', 'Status',
      'Completed', 'Submitted', 'Processing', 'Failed', 'Date', '7d', '30d', '90d', 'Custom',
      'Show results',
    ]) expect(all).toContain(expected);
    await act(async () => { t.unmount(); });
  });

  it('clean draft: pale "Show results" pill and Reset are inert', async () => {
    const t = await mount();
    // no PrimaryButton (the enabled state) is mounted
    const PB = require('../src/components/PrimaryButton').default;
    expect(t.root.findAll((n) => n.type === PB).length).toBe(0);
    // every chip unselected
    expect(t.root.findAll((n) => n.props.accessibilityRole === 'button' && n.props.accessibilityState?.selected === true).length).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('provider chips are single-select and any dirty state enables Show results', async () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <PerpsFilterSheet visible filters={DEFAULT_PERPS_ACTIVITY_FILTERS} onClose={onClose} onApply={onApply} />
        </SafeAreaProvider>,
      );
    });
    await act(async () => { chip(tree, 'Hyperliquid').props.onPress(); });
    await act(async () => { chip(tree, 'Aster').props.onPress(); });
    const selected = tree.root.findAll((n) => n.props.accessibilityRole === 'button' && n.props.accessibilityState?.selected === true).map((n) => n.props.children[1].props.children);
    expect(selected).toEqual(['Aster']); // picking Aster replaced Hyperliquid
    // now dirty -> the brand Show results button is mounted and applies
    const PB = require('../src/components/PrimaryButton').default;
    const btn = tree.root.find((n) => n.type === PB);
    expect(btn.props.label).toBe('Show results');
    await act(async () => { btn.props.onPress(); });
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ provider: 'aster' }));
    expect(onClose).toHaveBeenCalled();
    await act(async () => { tree.unmount(); });
  });

  it('Type/Status are multi-select; Date single; funding toggle flips the draft', async () => {
    const onApply = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <PerpsFilterSheet visible filters={DEFAULT_PERPS_ACTIVITY_FILTERS} onClose={jest.fn()} onApply={onApply} />
        </SafeAreaProvider>,
      );
    });
    await act(async () => { chip(tree, 'Trade').props.onPress(); });
    await act(async () => { chip(tree, 'Transfer').props.onPress(); });
    await act(async () => { chip(tree, 'Completed').props.onPress(); });
    await act(async () => { chip(tree, 'Failed').props.onPress(); });
    await act(async () => { chip(tree, '30d').props.onPress(); });
    await act(async () => { chip(tree, '90d').props.onPress(); });
    // funding payment toggle
    const sw = tree.root.find((n) => n.props.accessibilityRole === 'switch');
    await act(async () => { sw.props.onPress(); });
    const PB = require('../src/components/PrimaryButton').default;
    const btn = tree.root.find((n) => n.type === PB);
    await act(async () => { btn.props.onPress(); });
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      type: ['trade', 'transfer'],
      status: ['completed', 'failed'],
      date: '90d',           // 90d replaced 30d
      showFundingPayment: true,
    }));
    await act(async () => { tree.unmount(); });
  });

  it('Reset returns the draft to the defaults', async () => {
    const filters: PerpsActivityFilters = { provider: 'hyperliquid', assets: [], type: ['trade'], showFundingPayment: true, status: ['failed'], date: '30d' };
    const t = await mount(filters);
    await act(async () => { chip(t, 'Hyperliquid').props.onPress(); }); // deselect -> still dirty via type/status/date
    const reset = t.root.find((n) => typeof n.props.onPress === 'function' && n.props.children?.props?.children === 'Reset');
    await act(async () => { reset.props.onPress(); });
    expect(t.root.findAll((n) => n.props.accessibilityRole === 'button' && n.props.accessibilityState?.selected === true).length).toBe(0);
    await act(async () => { t.unmount(); });
  });
});
