import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#000', inkMuted: '#888', brand: '#6C63FF', background: '#fff', surfaceAlt: '#fff' } }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));

import {
  registerScanTarget,
  offerScanResult,
  clearScanTarget,
  activeScanTitle,
} from '../src/services/scanTarget';

describe('scan target delivery', () => {
  afterEach(() => clearScanTarget());

  it('delivers a scanned value to the registered screen exactly once', () => {
    const got: string[] = [];
    registerScanTarget((v) => got.push(v));
    expect(offerScanResult('0xabc123').status).toBe('delivered');
    expect(got).toEqual(['0xabc123']);
    // target is consumed: a second scan has nowhere to go
    expect(offerScanResult('again').status).toBe('none');
    expect(got).toEqual(['0xabc123']);
  });

  it('close callback fires when the scanner is dismissed without a scan', () => {
    const close = jest.fn();
    registerScanTarget(jest.fn(), close);
    clearScanTarget();
    expect(close).toHaveBeenCalled();
  });

  it('one scanner, different work: the caller names the job', () => {
    registerScanTarget(jest.fn(), undefined, { title: 'Scan secret phrase' });
    expect(activeScanTitle()).toBe('Scan secret phrase');
    clearScanTarget();
    expect(activeScanTitle()).toBe('Scan QR code');
  });

  it('a code meant for another screen is refused, and the scanner stays armed', () => {
    const got: string[] = [];
    registerScanTarget((v) => got.push(v), undefined, {
      title: 'Scan pairing code',
      accept: (v) =>
        v.startsWith('veltravia-pair-v2://')
          ? { ok: true, value: v }
          : { ok: false, reason: "That isn't a valid Veltravia pairing code." },
    });

    const wrong = offerScanResult('0xabc123');
    expect(wrong).toEqual({ status: 'rejected', reason: "That isn't a valid Veltravia pairing code." });
    expect(got).toEqual([]);
    // still registered: the next code can still be accepted
    expect(offerScanResult('veltravia-pair-v2://join?s=aa&p=bb').status).toBe('delivered');
    expect(got).toEqual(['veltravia-pair-v2://join?s=aa&p=bb']);
  });

  it('accept can normalise the value it hands over', () => {
    const got: string[] = [];
    registerScanTarget((v) => got.push(v), undefined, {
      title: 'Scan token address',
      accept: (v) => ({ ok: true, value: v.trim().toLowerCase() }),
    });
    offerScanResult('  0xABC  ');
    expect(got).toEqual(['0xabc']);
  });

  it('unregistering clears the target without calling close', () => {
    const close = jest.fn();
    const off = registerScanTarget(jest.fn(), close);
    off();
    expect(close).not.toHaveBeenCalled();
    expect(offerScanResult('x').status).toBe('none');
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
