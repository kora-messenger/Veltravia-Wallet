import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const theme = { mode: 'light' as 'light' | 'dark', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', background: '#FFFFFF', surface: '#F5F5F7' };
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ theme }) }));

import FloatingTabBar from '../src/components/FloatingTabBar';

const routes = [
  { key: 'Home-1', name: 'Home' },
  { key: 'Markets-1', name: 'Markets' },
  { key: 'Swap-1', name: 'Swap' },
  { key: 'Discover-1', name: 'Discover' },
  { key: 'Perps-1', name: 'Perps' },
];

const mount = async (active: string) => {
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
    getParent: () => ({ navigate: jest.fn() }),
  };
  const state: any = { index: routes.findIndex((r) => r.name === active), routes };
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <FloatingTabBar state={state} navigation={navigation as any} descriptors={{}} insets={{ top: 0, bottom: 0, left: 0, right: 0 }} />
      </SafeAreaProvider>,
    );
  });
  return { tree, navigation };
};

const flat = (style: any) => [style].flat(Infinity).filter(Boolean)
  .reduce((a: any, b: any) => ({ ...a, ...b }), {});
// host nodes only: the renderer reports composite and host layers for the same element
const host = (n: any) => typeof n.type === 'string';
const tabs = (t: renderer.ReactTestRenderer) => t.root.findAll((n) => host(n) && n.props.accessibilityRole === 'tab');
const highlights = (t: renderer.ReactTestRenderer) => t.root.findAll((n) => host(n) && n.props.testID === 'tabHighlight');
const valueOf = (v: any) => (typeof v === 'number' ? v : typeof v?.__getValue === 'function' ? v.__getValue() : v?._value);
const scaleOf = (h: any) => {
  const styles = [h.props.style].flat(Infinity).filter(Boolean);
  const tr = styles.map((x: any) => x.transform).filter(Boolean).pop() ?? [];
  return tr.find((t: any) => t && t.scale)?.scale;
};

describe('bottom navigation active highlight', () => {
  it('every tab carries an indicator, and only the active one shows it', async () => {
    const { tree } = await mount('Markets');
    expect(tabs(tree)).toHaveLength(5);                       // 4 side tabs + the floating Swap
    const hs = highlights(tree);
    expect(hs.length).toBe(4);
    const shown = hs.filter((h) => valueOf(flat(h.props.style).opacity) === 1);
    expect(shown.length).toBe(1);
    await act(async () => { tree.unmount(); });
  });

  it('the highlight is a circle (radius = half its height), not a rounded box on the icon cell', async () => {
    const { tree } = await mount('Markets');
    const h = highlights(tree)[0];
    const st = flat(h.props.style);
    expect(st.width).toBe(40);
    expect(st.height).toBe(40);
    expect(st.borderRadius).toBe(20);                          // 50%
    await act(async () => { tree.unmount(); });
  });

  it('the icon cell itself has no background at all any more (no grey box)', async () => {
    const { tree } = await mount('Markets');
    const cells = tree.root.findAll((n) => host(n) && flat(n.props.style).width === 48 && flat(n.props.style).height === 32);
    expect(cells.length).toBe(4);
    for (const c of cells) expect(flat(c.props.style).backgroundColor).toBeUndefined();
    await act(async () => { tree.unmount(); });
  });

  it('the icon cell keeps its 48x32 footprint, so no icon moves', async () => {
    // measured before the redesign: cell 48x32, icon 24
    const { tree } = await mount('Home');
    const cell = tree.root.findAll((n) => host(n) && flat(n.props.style).width === 48 && flat(n.props.style).height === 32)[0];
    expect(flat(cell.props.style)).toMatchObject({ width: 48, height: 32 });
    const icon = cell.findAll((n) => n.props.size === 24)[0];
    expect(icon).toBeTruthy();
    await act(async () => { tree.unmount(); });
  });

  it('the active tint is a subtle light grey, and reads as a tint in dark mode', async () => {
    const { tree } = await mount('Home');
    expect(flat(highlights(tree)[0].props.style).backgroundColor).toBe('#EFEFF2');
    await act(async () => { tree.unmount(); });

    theme.mode = 'dark';
    const dark = await mount('Home');
    expect(flat(highlights(dark.tree)[0].props.style).backgroundColor).toBe('rgba(255,255,255,0.10)');
    theme.mode = 'light';
    await act(async () => { dark.tree.unmount(); });
  });

  it('the switch animates: the active circle is at full scale, the others sit small and faded', async () => {
    const { tree } = await mount('Home');
    const hs = highlights(tree);
    const active = scaleOf(hs[0]);
    expect(active).toBeTruthy();                                  // a scale animation exists
    expect(valueOf(active)).toBeCloseTo(1, 2);
    const idle = scaleOf(hs[1]);
    expect(valueOf(idle)).toBeCloseTo(0.7, 2);                    // it grows in
    expect(valueOf(flat(hs[1].props.style).opacity)).toBe(0);
    await act(async () => { tree.unmount(); });
  });

  it('buttons report their selected state to screen readers', async () => {
    const { tree } = await mount('Discover');
    const states = tabs(tree).map((t) => t.props.accessibilityState.selected);
    expect(states.filter(Boolean)).toHaveLength(1);
    expect(states).toEqual([false, false, true, false, false]);   // Home, Markets, Discover, Perps, Swap
    await act(async () => { tree.unmount(); });
  });

  it('tapping still navigates, and a tap on the active tab does not re-navigate away', async () => {
    const { tree, navigation } = await mount('Home');
    await act(async () => { tabs(tree)[1].props.onClick?.() ?? tabs(tree)[1].props.onPress?.(); });
    expect(navigation.navigate).toHaveBeenCalledWith('Markets');
    await act(async () => { tree.unmount(); });
  });

  it('the centre Swap button takes the same grey when it is the active tab', async () => {
    const { tree } = await mount('Swap');
    const swap = tree.root.findAll((n) => host(n) && n.props.accessibilityLabel === 'Swap')[0];
    expect(swap.props.accessibilityState).toEqual({ selected: true });
    const st = swap.props.style;
    expect(flat(st).backgroundColor).toBe('#EFEFF2');
    await act(async () => { tree.unmount(); });
  });
});
