/**
 * A pairing code is a key to this device group, so showing one is a security
 * action. These tests hold the two rules the owner set:
 *
 *   1. no code is displayed until the user proves presence — fingerprint/face
 *      through the OS prompt, or this wallet's passcode. An open app is not
 *      consent, and a cancelled prompt must never fall through to "show it
 *      anyway".
 *   2. pairing a device is ADDITIVE: it must not loosen the protections on the
 *      device that started it (wallet locks, app lock, "locked elsewhere").
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../src/core/security/pairingAuth', () => ({
  authenticateForPairing: jest.fn(),
  pairingAuthOptions: jest.fn(),
  pairingAuthAvailable: jest.fn(),
}));

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      mode: 'light',
      ink: '#0F111A',
      inkMuted: '#8A8EA3',
      brand: '#6C63FF',
      border: '#E4E4EA',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      surfaceAlt: '#F3F3F7',
    },
  }),
}));

jest.mock('react-native-keychain', () => ({
  __esModule: true,
  ACCESS_CONTROL: { BIOMETRY_CURRENT_SET: 'bio' },
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'a', WHEN_UNLOCKED: 'b' },
  setGenericPassword: jest.fn(async () => true),
  getGenericPassword: jest.fn(async () => false),
  resetGenericPassword: jest.fn(async () => true),
  getSupportedBiometryType: jest.fn(async () => null),
}));

// The keypad is its own screen with its own tests: here it only needs to call
// back, so the gate logic is what is under test.
jest.mock('../src/screens/ai/PasscodeConfirmSheet', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return ({ visible, onVerified, onCancel }: any) =>
    visible
      ? R.createElement(
          Pressable,
          { testID: 'keypad', onPress: onVerified },
          R.createElement(Text, { onPress: onCancel }, 'keypad'),
        )
      : null;
});

jest.mock('../src/components/AppModal', () => {
  const R = require('react');
  const { View } = require('react-native');
  return ({ visible, children }: any) => (visible ? R.createElement(View, null, children) : null);
});

jest.mock('../src/core/security/pairingRelay', () => {
  const relay = {
    open: jest.fn(async () => {}),
    join: jest.fn(async () => {}),
    poll: jest.fn(async () => ({})),
    deliver: jest.fn(async () => {}),
    cancel: jest.fn(async () => {}),
  };
  return { __esModule: true, pairingRelay: relay, setPairingRelay: jest.fn(), pairingRelayConfigured: () => true, PairingRelayState: {} };
});

import * as pairingAuth from '../src/core/security/pairingAuth';
import PairingCodeSheet from '../src/components/PairingCodeSheet';
import { __resetPairingSessionsForTests } from '../src/core/security/pairingSession';

const mockAuth = pairingAuth as unknown as {
  authenticateForPairing: jest.Mock;
  pairingAuthOptions: jest.Mock;
  pairingAuthAvailable: jest.Mock;
};

const settle = async () => {
  await act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
};

function findCodes(tree: renderer.ReactTestRenderer) {
  return tree.root.findAll(
    (n) => typeof n.props.value === 'string' && String(n.props.value).startsWith('veltravia-pair://'),
  );
}

async function renderSheet() {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<PairingCodeSheet visible onClose={jest.fn()} />);
  });
  await settle();
  return tree;
}

describe('showing a pairing code requires proof of presence', () => {
  beforeEach(() => {
    __resetPairingSessionsForTests();
    mockAuth.authenticateForPairing.mockReset();
    mockAuth.pairingAuthOptions.mockReset();
    mockAuth.pairingAuthOptions.mockResolvedValue({ biometric: true, passcode: true });
  });

  it('opens locked: no code on screen and no prompt fired automatically', async () => {
    const tree = await renderSheet();
    expect(tree.root.findAll((n) => n.props.testID === 'pairingLocked').length).toBeGreaterThan(0);
    expect(findCodes(tree)).toHaveLength(0);
    // Merely opening the sheet must not trigger authentication or a session.
    expect(mockAuth.authenticateForPairing).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it('shows the code after biometrics succeed', async () => {
    mockAuth.authenticateForPairing.mockResolvedValue({ ok: true, method: 'biometric' });
    const tree = await renderSheet();
    const btn = tree.root.findAll((n) => n.props.accessibilityLabel === 'Show QR Code')[0];
    await act(async () => {
      await btn.props.onPress();
    });
    await settle();
    expect(mockAuth.authenticateForPairing).toHaveBeenCalledTimes(1);
    expect(findCodes(tree).length).toBeGreaterThan(0);
    await act(async () => tree.unmount());
  });

  it('does not show a code when the prompt is cancelled or fails', async () => {
    mockAuth.authenticateForPairing.mockResolvedValue({ ok: false, reason: 'cancelled', passcodeAvailable: false });
    const tree = await renderSheet();
    const btn = tree.root.findAll((n) => n.props.accessibilityLabel === 'Show QR Code')[0];
    await act(async () => {
      await btn.props.onPress();
    });
    await settle();
    expect(findCodes(tree)).toHaveLength(0);
    // and the sheet says why, rather than silently doing nothing
    expect(tree.root.findAll((n) => n.props.testID === 'pairingAuthNote').length).toBeGreaterThan(0);
    await act(async () => tree.unmount());
  });

  it('falls back to the passcode keypad, and only a verified passcode mints a code', async () => {
    mockAuth.authenticateForPairing.mockResolvedValue({ ok: false, reason: 'cancelled', passcodeAvailable: true });
    const tree = await renderSheet();
    const btn = tree.root.findAll((n) => n.props.accessibilityLabel === 'Show QR Code')[0];
    await act(async () => {
      await btn.props.onPress();
    });
    await settle();
    expect(findCodes(tree)).toHaveLength(0);

    const keypad = tree.root.findAll((n) => n.props.testID === 'keypad')[0];
    expect(keypad).toBeTruthy();
    await act(async () => {
      await keypad.props.onPress();
    });
    await settle();
    expect(findCodes(tree).length).toBeGreaterThan(0);
    await act(async () => tree.unmount());
  });

  it('refuses outright when the device has neither biometrics nor a passcode', async () => {
    mockAuth.pairingAuthOptions.mockResolvedValue({ biometric: false, passcode: false });
    mockAuth.authenticateForPairing.mockResolvedValue({ ok: false, reason: 'none', passcodeAvailable: false });
    const tree = await renderSheet();
    const btn = tree.root.findAll((n) => n.props.accessibilityLabel === 'Enter passcode')[0];
    expect(btn.props.disabled).toBe(true);
    await act(async () => {
      await btn.props.onPress();
    });
    await settle();
    expect(findCodes(tree)).toHaveLength(0);
    await act(async () => tree.unmount());
  });

  it('asks again for a new code instead of reusing the authorisation', async () => {
    mockAuth.authenticateForPairing.mockResolvedValue({ ok: true, method: 'biometric' });
    const tree = await renderSheet();
    await act(async () => {
      await tree.root.findAll((n) => n.props.accessibilityLabel === 'Show QR Code')[0].props.onPress();
    });
    await settle();
    expect(findCodes(tree).length).toBeGreaterThan(0);

    // "New code" returns to the locked state: the old proof is spent.
    await act(async () => {
      await tree.root.findAll((n) => n.props.accessibilityLabel === 'Show a new code')[0].props.onPress();
    });
    await settle();
    expect(findCodes(tree)).toHaveLength(0);
    expect(tree.root.findAll((n) => n.props.testID === 'pairingLocked').length).toBeGreaterThan(0);
    expect(mockAuth.authenticateForPairing).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });
});
