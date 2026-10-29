import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#000', inkMuted: '#888', brand: '#6C63FF', background: '#fff', surfaceAlt: '#fff' } }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));

import { registerScanTarget, deliverScanResult, clearScanTarget } from '../src/services/scanTarget';

describe('scan target delivery', () => {
  afterEach(() => clearScanTarget());

  it('delivers a scanned value to the registered screen exactly once', () => {
    const got: string[] = [];
    registerScanTarget((v) => got.push(v));
    expect(deliverScanResult('0xabc123')).toBe(true);
    expect(got).toEqual(['0xabc123']);
    // target is consumed: a second scan has nowhere to go
    expect(deliverScanResult('again')).toBe(false);
    expect(got).toEqual(['0xabc123']);
  });

  it('close callback fires when the scanner is dismissed without a scan', () => {
    const close = jest.fn();
    registerScanTarget(jest.fn(), close);
    clearScanTarget();
    expect(close).toHaveBeenCalled();
  });

  it('unregistering clears the target without calling close', () => {
    const close = jest.fn();
    const off = registerScanTarget(jest.fn(), close);
    off();
    expect(close).not.toHaveBeenCalled();
    expect(deliverScanResult('x')).toBe(false);
  });
});

import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ScanQrScreen from '../src/screens/ScanQrScreen';

describe('ScanQrScreen', () => {
  it('renders the header (title, close, gallery, torch) with the camera granted', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 411, height: 891 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}><NavigationContainer><ScanQrScreen /></NavigationContainer></SafeAreaProvider>); });
    const texts = tree!.root.findAll((n) => typeof n.props.children === 'string' && n.props.children === 'Scan QR code');
    expect(texts.length).toBeGreaterThanOrEqual(1);
    // 4 header buttons (close, gallery, torch) render as elements with hitSlop
    const btns = tree!.root.findAll((n) => n.props.hitSlop === 10);
    expect(btns.length).toBeGreaterThanOrEqual(3);
    act(() => { tree!.unmount(); });
  });

  it('matches Trust\'s measured geometry: 47dp buttons, 55dp arms, 10dp lines, centred title', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 411, height: 891 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}><NavigationContainer><ScanQrScreen /></NavigationContainer></SafeAreaProvider>); });
    const flat = (st: any) => [st].flat(Infinity).filter(Boolean).reduce((a: any, b: any) => ({ ...a, ...b }), {});
    const byLabel = (l: string) => tree!.root.findAll((n) => n.props.accessibilityLabel === l && !!n.props.style)[0];
    const close = flat(byLabel('Close scanner').props.style);
    expect(close.width).toBe(47);
    expect(close.height).toBe(47);
    expect(close.borderRadius).toBe(23.5);
    expect(close.backgroundColor).toBe('#202020');   // solid, not translucent
    const gallery = flat(byLabel('Pick a QR image').props.style);
    expect(gallery.width).toBe(47);
    // brackets: 55dp arms with a 10dp line
    const brackets = tree!.root.findAll((n) => !!n.props.style && flat(n.props.style).width === 55 && flat(n.props.style).borderWidth === 10);
    // test-renderer surfaces each styled node twice (component + host); dedupe by corner
    const corners = new Set(brackets.map((n) => { const st = flat(n.props.style); return `${st.left}-${st.right}-${st.top}-${st.bottom}`; }));
    expect(corners.size).toBe(4);
    act(() => { tree!.unmount(); });
  });
});
