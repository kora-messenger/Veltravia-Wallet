import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

let captured: any = null;
jest.mock('react-native-vision-camera', () => {
  const React2 = require('react');
  return {
    Camera: () => React2.createElement('Camera'),
    useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
    useCameraDevice: () => ({ id: 'back' }),
    useCodeScanner: (cfg: any) => { captured = cfg; return cfg; },
  };
});
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ theme: { mode: 'dark', ink: '#fff', background: '#000' } }) }));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));

import { NativeModules } from 'react-native';
import ScanQrScreen from '../src/screens/ScanQrScreen';
import { registerScanTarget, clearScanTarget } from '../src/services/scanTarget';

const mockFeedback = { capture: jest.fn(), bell: jest.fn() };
beforeAll(() => { (NativeModules as any).VeltraviaScanFeedback = mockFeedback; });

const mount = () => renderer.create(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 411, height: 891 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}>
    <NavigationContainer><ScanQrScreen /></NavigationContainer>
  </SafeAreaProvider>,
);

describe('scanner brackets chase the code before reading it', () => {
  afterEach(() => { clearScanTarget(); jest.useRealTimers(); jest.clearAllMocks(); });

  it('does not report the code the instant it appears; it frames it first', async () => {
    jest.useFakeTimers();
    const got: string[] = [];
    registerScanTarget((v) => got.push(v));
    let t: renderer.ReactTestRenderer;
    await act(async () => { t = mount(); });

    await act(async () => {
      captured.onCodeScanned([{ type: 'qr', value: '0xdeadbeef', frame: { x: 150, y: 400, width: 90, height: 90 } }]);
    });
    expect(got).toEqual([]);                       // nothing yet: the box is still travelling

    await act(async () => { jest.advanceTimersByTime(600); });
    expect(got).toEqual(['0xdeadbeef']);           // arrives once it has settled on the code
    await act(async () => { t.unmount(); });
  });

  it('locks on: once chasing, a second code cannot hijack the read', async () => {
    jest.useFakeTimers();
    const got: string[] = [];
    registerScanTarget((v) => got.push(v));
    let t: renderer.ReactTestRenderer;
    await act(async () => { t = mount(); });
    await act(async () => {
      captured.onCodeScanned([{ type: 'qr', value: 'first', frame: { x: 100, y: 300, width: 120, height: 120 } }]);
      captured.onCodeScanned([{ type: 'qr', value: 'second', frame: { x: 300, y: 700, width: 60, height: 60 } }]);
    });
    await act(async () => { jest.advanceTimersByTime(600); });
    expect(got).toEqual(['first']);
    await act(async () => { t.unmount(); });
  });

  it('still reads a code whose position is unknown, without waiting', async () => {
    jest.useFakeTimers();
    const got: string[] = [];
    registerScanTarget((v) => got.push(v));
    let t: renderer.ReactTestRenderer;
    await act(async () => { t = mount(); });
    await act(async () => { captured.onCodeScanned([{ type: 'qr', value: 'no-geometry' }]); });
    expect(got).toEqual(['no-geometry']);
    await act(async () => { t.unmount(); });
  });

  it('rings the capture bell at the moment the code is taken', async () => {
    jest.useFakeTimers();
    registerScanTarget(jest.fn());
    let t: renderer.ReactTestRenderer;
    await act(async () => { t = mount(); });
    await act(async () => {
      captured.onCodeScanned([{ type: 'qr', value: '0xabc', frame: { x: 150, y: 400, width: 90, height: 90 } }]);
    });
    expect(mockFeedback.capture).not.toHaveBeenCalled();     // still framing
    await act(async () => { jest.advanceTimersByTime(600); });
    expect(mockFeedback.capture).toHaveBeenCalledTimes(1);   // bell + tick as it is read
    await act(async () => { t.unmount(); });
  });
});
