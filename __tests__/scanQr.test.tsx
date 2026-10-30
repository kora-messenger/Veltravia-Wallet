import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Dimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

const permission = { granted: true };
jest.mock('react-native-vision-camera', () => {
  const React2 = require('react');
  return {
    Camera: () => React2.createElement('Camera'),
    useCameraPermission: () => ({ hasPermission: permission.granted, requestPermission: jest.fn() }),
    useCameraDevice: () => ({ id: 'back' }),
    useCodeScanner: (cfg: any) => cfg,
  };
});
jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#000', inkMuted: '#888', brand: '#6C63FF', background: '#fff', surfaceAlt: '#fff' } }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));

import ScanQrScreen from '../src/screens/ScanQrScreen';
import { registerScanTarget, clearScanTarget } from '../src/services/scanTarget';
import { scanWindow } from '../src/core/scan/window';

const mount = () => renderer.create(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 411, height: 891 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}>
    <NavigationContainer><ScanQrScreen /></NavigationContainer>
  </SafeAreaProvider>,
);

const flatStyle = (node: any) => [node.props.style].flat(Infinity).filter(Boolean)
  .reduce((a: any, b: any) => ({ ...a, ...b }), {});

describe('ScanQrScreen', () => {
  beforeAll(() => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 411, height: 891, scale: 2, fontScale: 1 } as any);
  });
  afterEach(() => { clearScanTarget(); permission.granted = true; });

  it('reads like the reference: translucent close, centred title, gallery and torch', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = mount(); });

    const title = tree.root.findAll((n) => n.props.testID === 'scanTitle')[0];
    expect(title.props.children).toBe('Scan QR code');
    expect(flatStyle(title)).toMatchObject({ textAlign: 'center', color: '#FFFFFF', fontSize: 20, fontWeight: '700' });

    const close = tree.root.findAll((n) => n.props.testID === 'scanClose')[0];
    expect(flatStyle(close)).toMatchObject({ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.42)' });
    expect(close.props.accessibilityLabel).toBe('Close scanner');

    for (const id of ['scanGallery', 'scanTorch']) {
      const btn = tree.root.findAll((n) => n.props.testID === id)[0];
      expect(flatStyle(btn)).toMatchObject({ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.42)' });
    }
    act(() => { tree.unmount(); });
  });

  it('draws four separate white brackets, with no border and no filled box in the window', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = mount(); });
    // "CornerBrackets" labels each path for its corner
    const paths = tree.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('scanCorner'));
    const ids = new Set(paths.map((p) => p.props.testID));
    expect(ids.size).toBe(4);
    // svg normalises the colour to an int: 0xFFFFFFFF is opaque white
    const isWhite = (c: any) => c === '#FFFFFF' || (c && c.payload === 0xFFFFFFFF);
    for (const p of paths) expect(isWhite(p.props.stroke)).toBe(true);

    const win = tree.root.findAll((n) => n.props.testID === 'scanWindow')[0];
    const s = flatStyle(win);
    expect(s.backgroundColor).toBeUndefined();        // nothing hiding the feed
    expect(s.borderWidth).toBeUndefined();            // no closed border
    act(() => { tree.unmount(); });
  });

  it('sizes the window from the reference: 67% of the width, centred', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = mount(); });
    const win = tree.root.findAll((n) => n.props.testID === 'scanWindow')[0];
    const expected = scanWindow(411, 891);
    expect(flatStyle(win)).toMatchObject({ left: expected.x, top: expected.y, width: expected.size, height: expected.size });
    expect(expected.size / 411).toBeCloseTo(0.673, 2);
    act(() => { tree.unmount(); });
  });

  it('the torch toggles, and the button says which way it will go', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = mount(); });
    const btn = () => tree.root.findAll((n) => n.props.testID === 'scanTorch')[0];
    expect(btn().props.accessibilityLabel).toBe('Turn the flashlight on');
    expect(btn().props.accessibilityState).toEqual({ selected: false });
    act(() => { btn().props.onPress(); });
    expect(btn().props.accessibilityLabel).toBe('Turn the flashlight off');
    expect(btn().props.accessibilityState).toEqual({ selected: true });
    act(() => { tree.unmount(); });
  });

  it('a caller with its own job names the screen, and the copy follows', () => {
    registerScanTarget(jest.fn(), undefined, { title: 'Scan address' });
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = mount(); });
    expect(tree.root.findAll((n) => n.props.testID === 'scanTitle')[0].props.children).toBe('Scan address');
    act(() => { tree.unmount(); });
  });

  it('permission refused explains itself, offers the prompt, settings, and a way out', () => {
    permission.granted = false;
    let tree!: renderer.ReactTestRenderer;
    act(() => { tree = mount(); });
    const texts = tree.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts).toContain('Camera access is off');
    for (const label of ['Allow camera', 'Open settings', 'Close scanner']) {
      expect(tree.root.findAll((n) => n.props.accessibilityLabel === label).length).toBeGreaterThan(0);
    }
    act(() => { tree.unmount(); });
  });
});
