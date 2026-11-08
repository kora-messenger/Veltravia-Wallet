/**
 * Tapping the fingerprint key on the lock screen opens OUR biometric screen
 * (Ijezie, 6 Nov 2026), with the device's own dialog on top of it doing the
 * scan. This pins the wiring: the screen appears, it names a refusal, and
 * "Use passcode instead" gets the user back to the keypad.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: require('../src/theme/tokens').themes.light }),
}));
jest.mock('../src/core/security', () => ({ setFlagSecure: jest.fn() }));
jest.mock('../src/core/storage/passcode', () => ({ verifyPasscode: jest.fn(async () => true) }));

const mockPrompt = jest.fn();
jest.mock('../src/core/security/biometrics', () => ({
  isBiometricsSupported: jest.fn(async () => true),
  isBiometricUnlockEnabled: jest.fn(async () => true),
  getBiometryType: jest.fn(async () => 'touchId'),
  promptBiometrics: (...a: any[]) => mockPrompt(...a),
}));

import { AppState, Image } from 'react-native';
import LockScreen from '../src/screens/LockScreen';

// The lock screen refuses to prompt from the background; in the test env the
// AppState stub reports 'unknown', so pin it to a foreground app.
Object.defineProperty(AppState, 'currentState', { get: () => 'active', configurable: true });

const textOf = (tree: any): string =>
  tree.root
    .findAll((n: any) => n.type === 'Text')
    .map((n: any) => [].concat(n.props.children).join(''))
    .join(' | ');

beforeEach(() => {
  JestTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

function JestTimers() {
  jest.useFakeTimers();
  mockPrompt.mockReset();
}

const mount = async () => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<LockScreen onUnlock={jest.fn()} onScan={jest.fn()} />);
  });
  return tree;
};

const settle = async (tree: any, ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  return tree;
};

describe('lock screen layout', () => {
  it('shows the app mark above the keypad (Ijezie asked for it back, 8 Nov)', async () => {
    mockPrompt.mockReturnValue(new Promise(() => {}));
    const tree = await mount();
    // Image renders a wrapper too; the mark is the one carrying the sizing.
    const marks = tree.root.findAllByType(Image).filter((n: any) => n.props.style?.width === 88);
    expect(marks.length).toBe(1);
    expect(marks[0].props.style).toMatchObject({ width: 88, height: 88 });
    expect(textOf(tree)).toContain('Enter passcode');
    await act(async () => tree.unmount());
  });
});

describe('lock screen biometrics', () => {
  it('presents our screen while the device dialog is up', async () => {
    mockPrompt.mockReturnValue(new Promise(() => {})); // stays open
    const tree = await mount();
    await settle(tree, 500);
    expect(mockPrompt).toHaveBeenCalled();
    expect(textOf(tree)).toContain('Verify it’s you');
    expect(textOf(tree)).toContain('Touch the sensor to confirm it is you.');
    await act(async () => tree.unmount());
  });

  it('keeps the user on our screen when the sensor refuses, and offers the way back', async () => {
    mockPrompt.mockResolvedValue(false);
    const tree = await mount();
    await settle(tree, 500);
    expect(textOf(tree)).toContain('Fingerprint not recognised. Try again.');

    const btn = tree.root.find(
      (n: any) => n.props?.accessibilityLabel === 'Use passcode instead' && typeof n.props?.onPress === 'function',
    );
    await act(async () => btn.props.onPress());
    // Back on the keypad, and the opt-out holds: no prompt is re-presented.
    expect(textOf(tree)).toContain('Enter passcode');
    expect(textOf(tree)).not.toContain('Verify it’s you');
    const calls = mockPrompt.mock.calls.length;
    await settle(tree, 1000);
    expect(mockPrompt.mock.calls.length).toBe(calls);
    await act(async () => tree.unmount());
  });
});
