import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', background: '#FFFFFF', surface: '#F5F5F7', surfaceAlt: '#F3F4FA' } }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));
const mockOpenInBrowser = jest.fn((url: string, opts?: { dapp?: boolean }) => true);
jest.mock('../src/services/browserState', () => ({
  openInBrowser: (url: string, opts?: { dapp?: boolean }) => mockOpenInBrowser(url, opts),
}));

import DiscoverScreen from '../src/screens/DiscoverScreen';
import { DAPPS } from '../src/services/discoverData';

const texts = (tree: renderer.ReactTestRenderer) =>
  tree.root
    .findAll((n) => typeof n.props.children === 'string' || (Array.isArray(n.props.children) && n.props.children.every((c: unknown) => typeof c === 'string')))
    .map((n) => (Array.isArray(n.props.children) ? n.props.children.join('') : (n.props.children as string)));

const mount = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <NavigationContainer><DiscoverScreen /></NavigationContainer>
      </SafeAreaProvider>); });
  return tree;
};

const press = async (t: renderer.ReactTestRenderer, label: string) => {
  const n = t.root.find((x) => x.props.accessibilityLabel === label && typeof x.props.onPress === 'function');
  await act(async () => { n.props.onPress(); });
};

/** Tap the dApp row whose visible name matches. */
const tapDapp = async (t: renderer.ReactTestRenderer, name: string) => {
  const label = t.root.find((n) => n.props.children === name);
  // walk up to the nearest row with an onPress
  let node: any = label;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error('dApp row not tappable');
  await act(async () => { node.props.onPress(); });
};

describe('dApp disclaimer (rebuilt)', () => {
  const aaveName = (DAPPS.find((d) => /aave/i.test(d.name)) ?? DAPPS[0]).name;
  const aave = DAPPS.find((d) => d.name === aaveName)!;

  beforeEach(() => { mockOpenInBrowser.mockClear(); });

  it('tapping a dApp shows the popup on the Discover screen and opens NOTHING yet', async () => {
    const t = await mount();
    await tapDapp(t, aaveName);
    const all = texts(t);
    expect(all).toContain('Disclaimer');
    expect(all.some((x) => x.includes('do not own, operate, or endorse'))).toBe(true);
    expect(mockOpenInBrowser).not.toHaveBeenCalled();
    await act(async () => { t.unmount(); });
  });

  it('Cancel and X dismiss the popup and never open the browser', async () => {
    const t = await mount();
    await tapDapp(t, aaveName);
    await press(t, 'Cancel');
    expect(texts(t)).not.toContain('Disclaimer');
    expect(mockOpenInBrowser).not.toHaveBeenCalled();
    await tapDapp(t, aaveName);
    await press(t, 'Close disclaimer');
    expect(mockOpenInBrowser).not.toHaveBeenCalled();
    await act(async () => { t.unmount(); });
  });

  it('Confirm stays disabled until the box is ticked; ticked Confirm opens the dApp', async () => {
    const t = await mount();
    await tapDapp(t, aaveName);

    const confirm = () => t.root.find((n) => n.props.accessibilityLabel === 'Confirm');
    expect(confirm().props.disabled).toBe(true);
    await press(t, 'I accept the Terms of Use');
    expect(confirm().props.disabled).toBe(false);
    await press(t, 'Confirm');

    expect(mockOpenInBrowser).toHaveBeenCalledTimes(1);
    expect(mockOpenInBrowser.mock.calls[0][0]).toBe(aave.url);
    expect(mockOpenInBrowser.mock.calls[0][1]).toEqual({ dapp: true });
    expect(texts(t)).not.toContain('Disclaimer'); // popup dismissed
    await act(async () => { t.unmount(); });
  });
});
