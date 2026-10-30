/**
 * The two halves of the pairing flow the screenshots asked for:
 *   • an existing device shows the code inside Manage account;
 *   • a new device picks "Pair device" on the recovery screen and scans it.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

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
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'a', WHEN_UNLOCKED: 'b' },
  setGenericPassword: jest.fn(async () => true),
  getGenericPassword: jest.fn(async () => false),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('../src/core/storage/secureStorage', () => ({
  __esModule: true,
  readSeed: jest.fn(async () => 'legal winner thank year wave sausage worth useful legal winner thank yellow'),
}));

jest.mock('../src/screens/ai/PasscodeConfirmSheet', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return ({ visible, onVerified }: any) =>
    visible ? R.createElement(Pressable, { onPress: onVerified }, R.createElement(Text, null, 'keypad')) : null;
});

jest.mock('../src/components/AppModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible, children }: any) => (visible ? React.createElement(View, null, children) : null);
});

import SelectRecoveryMethodScreen from '../src/screens/SelectRecoveryMethodScreen';
import * as pairingAuth from '../src/core/security/pairingAuth';
import PairingCodeSheet from '../src/components/PairingCodeSheet';

const mockAuth = pairingAuth as unknown as {
  authenticateForPairing: jest.Mock;
  pairingAuthOptions: jest.Mock;
  pairingAuthAvailable: jest.Mock;
};
import { parseQr } from '../src/services/qrParse';
import { deriveSeedGroup } from '../src/core/security/walletGroup';
import { startPairingSession, __resetPairingSessionsForTests } from '../src/core/security/pairingSession';
import { setPairingRelay } from '../src/core/security/pairingRelay';

jest.mock('../src/core/security/pairingAuth', () => ({
  authenticateForPairing: jest.fn(),
  pairingAuthOptions: jest.fn(),
  pairingAuthAvailable: jest.fn(),
}));

describe('recovery screen pairing entry', () => {
  it('lists "Pair device" and hands the tap to the scanner', async () => {
    const onPairDevice = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SelectRecoveryMethodScreen onBack={jest.fn()} onSecretPhrase={jest.fn()} onPairDevice={onPairDevice} />,
      );
    });
    const labels = tree.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(labels).toContain('Pair device');

    const row = tree.root.findAll((n) => n.props.onPress && typeof n.props.onPress === 'function' && n.props.android_ripple);
    // newest row is last in the list
    await act(async () => {
      row[row.length - 1].props.onPress();
    });
    expect(onPairDevice).toHaveBeenCalledTimes(1);
    await act(async () => { tree.unmount(); });
  });
});

/** No network in tests: a relay that just holds the row. */
function stubRelay() {
  setPairingRelay({
    open: async () => {},
    join: async () => {},
    poll: async () => ({}),
    deliver: async () => {},
    cancel: async () => {},
  });
}

describe('the code sheet an existing device shows', () => {
  beforeEach(() => {
    __resetPairingSessionsForTests();
    stubRelay();
    mockAuth.authenticateForPairing.mockResolvedValue({ ok: true, method: 'biometric' });
    mockAuth.pairingAuthOptions.mockResolvedValue({ biometric: true, passcode: true });
  });

  it('stays locked until the owner confirms it is them', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PairingCodeSheet visible onClose={jest.fn()} />);
    });
    await act(async () => {
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });
    expect(tree.root.findAll((n) => n.props.testID === 'pairingLocked').length).toBeGreaterThan(0);
    await act(async () => { tree.unmount(); });
  });

  it('renders a live code with a countdown, and never the phrase', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PairingCodeSheet visible onClose={jest.fn()} />);
    });
    // minting the session is async: let the effect settle
    await act(async () => {
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });
    // unlock first: no code is shown until presence is proven
    await act(async () => {
      await tree.root.findAll((n) => n.props.accessibilityLabel === 'Show QR Code')[0].props.onPress();
    });
    await act(async () => {
      for (let i = 0; i < 20; i++) await Promise.resolve();
    });
    expect(tree.root.findAll((n) => n.props.testID === 'pairingCodeSheet').length).toBeGreaterThan(0);
    const timer = tree.root.findAll((n) => n.props.testID === 'pairingTimer')[0];
    expect([timer.props.children].flat().join('')).toMatch(/Expires in \d+:\d\d/);

    // the QrCode receives a pairing URI: session id + one-time public key only
    const qr = tree.root.findAll((n) => typeof n.props.value === 'string' && n.props.value.startsWith('veltravia-pair://'));
    expect(qr.length).toBeGreaterThan(0);
    expect(String(qr[0].props.value)).not.toContain('legal winner');
    await act(async () => { tree.unmount(); });
  });
});

describe('the code itself', () => {
  it('is classified as a pairing code, not a plain link', async () => {
    __resetPairingSessionsForTests();
    const session = await startPairingSession();
    const parsed = parseQr(session.uri);
    expect(parsed.kind).toBe('pairing');
    expect(parsed.label).toBe('Pair this device');
  });

  it('carries no wallet secrets now that pairing is a handshake', async () => {
    __resetPairingSessionsForTests();
    const { key } = deriveSeedGroup('some phrase');
    const session = await startPairingSession();
    expect(session.uri).not.toContain(key);
    expect(session.uri.length).toBeLessThan(140);
  });

  it('never carries the seed', async () => {
    __resetPairingSessionsForTests();
    const seed = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
    const session = await startPairingSession();
    expect(session.uri).not.toContain(seed);
    expect(session.uri.toLowerCase()).not.toContain('legal');
  });
});
