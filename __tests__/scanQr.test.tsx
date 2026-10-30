import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#000', inkMuted: '#888', brand: '#6C63FF', background: '#fff', surfaceAlt: '#fff' } }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));
jest.mock('react-native-vision-camera', () => {
  const React2 = require('react');
  return {
    Camera: () => React2.createElement('Camera'),
    useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
    useCameraDevice: () => ({ id: 'back' }),
    useCodeScanner: (cfg: any) => cfg,
  };
});

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import ScanQrScreen from '../src/screens/ScanQrScreen';
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


describe('ScanQrScreen', () => {
  const mount = () => renderer.create(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 411, height: 891 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}>
      <NavigationContainer><ScanQrScreen /></NavigationContainer>
    </SafeAreaProvider>,
  );

  it('is the link-device scanner: gradient headline, pairing copy, live window', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = mount(); });
    const text = (t: renderer.ReactTestRenderer) => t.root
      .findAll((n) => typeof n.props.children === 'string')
      .map((n) => n.props.children as string)
      .join('|');
    // "QR Code" is drawn with the gradient, "Scan " is plain
    expect(text(tree!)).toContain('Scan ');
    expect(text(tree!)).toContain('Open your existing device and scan the QR code to pair.');
    expect(text(tree!)).toContain('Make sure the QR code is clearly visible and within the frame.');
    expect(text(tree!)).toContain('Cancel');
    // no logo, no app name on this screen
    expect(text(tree!)).not.toContain('Veltravia Wallet');
    // four glowing corners on the window
    const corners = new Set(tree!.root
      .findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('scanCorner'))
      .map((n) => n.props.testID));
    expect(corners.size).toBe(4);
    act(() => { tree!.unmount(); });
  });

  it('shows the expiry pill on the link-device scan and counts it down', () => {
    jest.useFakeTimers();
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = mount(); });
    const pill = () => tree!.root.findAll((n) => n.props.testID === 'scanExpiry')[0];
    expect(pill()).toBeTruthy();
    expect(pill().props.accessibilityLabel).toBe('Expires in 60 seconds');
    act(() => { jest.advanceTimersByTime(3000); });
    expect(pill().props.accessibilityLabel).toBe('Expires in 57 seconds');
    act(() => { jest.advanceTimersByTime(60000); });
    expect(pill().props.accessibilityLabel).toBe('Code expired, tap to rescan');
    act(() => { tree!.unmount(); });
    jest.useRealTimers();
  });

  it('a caller with its own job hides the pairing pill and keeps its own title', () => {
    registerScanTarget(jest.fn(), undefined, { title: 'Scan address', hint: 'Point at an address QR code' });
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = mount(); });
    expect(tree!.root.findAll((n) => n.props.testID === 'scanExpiry')).toHaveLength(0);
    const text = tree!.root
      .findAll((n) => typeof n.props.children === 'string')
      .map((n) => n.props.children as string)
      .join('|');
    expect(text).toContain('Point at an address QR code');
    act(() => { tree!.unmount(); });
    clearScanTarget();
  });

  it('keeps the back, gallery and torch controls', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = mount(); });
    for (const label of ['Close scanner', 'Pick a QR image', 'Torch']) {
      expect(tree!.root.findAll((n) => n.props.accessibilityLabel === label).length).toBeGreaterThan(0);
    }
    act(() => { tree!.unmount(); });
  });
});
