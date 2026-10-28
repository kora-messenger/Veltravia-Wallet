import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', border: '#E4E4EA', background: '#FFFFFF' } }),
}));
jest.mock('../src/core/security/biometrics', () => ({
  biometricsAvailable: jest.fn(async () => false),
  biometricUnlockEnabled: jest.fn(async () => false),
  presentBiometricUnlock: jest.fn(async () => false),
}));
jest.mock('../src/core/storage/passcode', () => ({
  getPasscode: jest.fn(async () => null),
  checkPasscode: jest.fn(async () => true),
}));

import LockScreen from '../src/screens/LockScreen';

describe('lock screen scan button', () => {
  it('shows a scan button that opens the scanner WITHOUT unlocking', async () => {
    const onScan = jest.fn();
    const onUnlock = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<LockScreen onUnlock={onUnlock} onScan={onScan} />);
    });
    const btn = tree.root.find((n) => n.props.accessibilityLabel === 'Scan QR code');
    expect(typeof btn.props.onPress).toBe('function');
    await act(async () => { btn.props.onPress(); });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onUnlock).not.toHaveBeenCalled(); // the app stays locked
    await act(async () => { tree.unmount(); });
  });
});
