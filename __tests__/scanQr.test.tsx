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
import ScanQrScreen from '../src/screens/ScanQrScreen';

describe('ScanQrScreen', () => {
  it('renders the header (title, close, gallery, torch) with the camera granted', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => { tree = renderer.create(<NavigationContainer><ScanQrScreen /></NavigationContainer>); });
    const texts = tree!.root.findAll((n) => typeof n.props.children === 'string' && n.props.children === 'Scan QR code');
    expect(texts.length).toBeGreaterThanOrEqual(1);
    // 4 header buttons (close, gallery, torch) render as elements with hitSlop
    const btns = tree!.root.findAll((n) => n.props.hitSlop === 10);
    expect(btns.length).toBeGreaterThanOrEqual(3);
    act(() => { tree!.unmount(); });
  });
});
