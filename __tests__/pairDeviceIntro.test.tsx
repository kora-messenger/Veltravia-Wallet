/**
 * The "Pair a New Device" card that now sits in front of the code.
 *
 * What matters: it is the pre-code screen (nothing minted), it says what the
 * design says, and the purple button still goes through proof of presence.
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

jest.mock('../src/core/security/pairingAuth', () => ({
  authenticateForPairing: jest.fn(async () => ({ ok: false, reason: 'cancelled' })),
  pairingAuthOptions: jest.fn(async () => ({ biometric: true, passcode: true })),
}));

jest.mock('../src/core/security/pairingSession', () => ({
  startPairingSession: jest.fn(),
  currentPairingSession: jest.fn(() => null),
  waitForJoiner: jest.fn(async () => ({ status: 'expired' })),
  cancelPairingSession: jest.fn(async () => {}),
  approveJoiner: jest.fn(async () => true),
  __resetPairingSessionsForTests: jest.fn(),
}));

jest.mock('../src/components/QrCode', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ value }: any) => React.createElement(View, { testID: 'qr', value });
});

jest.mock('../src/core/security/walletGroup', () => ({
  ensureGroup: jest.fn(async () => ({ groupId: 'g', key: 'k' })),
  getGroup: jest.fn(async () => ({ groupId: 'g', key: 'k', epoch: 0 })),
}));

jest.mock('../src/screens/ai/PasscodeConfirmSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible }: any) => (visible ? React.createElement(View, { testID: 'passcodeSheet' }) : null);
});

import PairingCodeSheet from '../src/components/PairingCodeSheet';
import { authenticateForPairing } from '../src/core/security/pairingAuth';

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const texts = (t: any): string => {
  const out: string[] = [];
  const walk = (n: any) => {
    if (typeof n === 'string' || typeof n === 'number') out.push(String(n));
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && n.children) walk(n.children);
  };
  walk(t.toJSON());
  return out.join(' ');
};

const mount = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<PairingCodeSheet visible onClose={jest.fn()} />);
  });
  await settle();
  return tree;
};

beforeEach(() => (authenticateForPairing as jest.Mock).mockClear());

describe('Pair a New Device intro', () => {
  it('explains the pairing before any code exists', async () => {
    const tree = await mount();
    const shown = texts(tree);

    expect(shown).toContain('Pair a New Device');
    expect(shown).toContain('Scan the QR code with your new device to securely link it to your Veltravia Wallet.');
    expect(shown).toContain('Secure & Encrypted');
    expect(shown).toContain('Link to Your Wallet');
    expect(shown).toContain('QR Code Expires');
    expect(shown).toContain('The code will expire in 60 seconds for your security.');
    expect(shown).toContain('Only show this QR code to someone you are pairing in person. Do not share it with anyone.');

    // No code, no session, no prompting: this screen is a decision, not a mint.
    expect(tree.root.findAll((n) => n.props.testID === 'qr')).toHaveLength(0);
    expect(authenticateForPairing).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it('draws the illustration with the design\'s three feature bubbles and notice', async () => {
    const tree = await mount();
    // test-renderer surfaces each styled node twice (component + host), so > 0.
    expect(tree.root.findAll((n) => n.props.testID === 'pairIntro').length).toBeGreaterThan(0);
    for (const key of ['shield', 'phone', 'clock']) {
      expect(tree.root.findAll((n) => n.props.testID === `pairFeature-${key}`).length).toBeGreaterThan(0);
    }
    expect(tree.root.findAll((n) => n.props.testID === 'pairNotice').length).toBeGreaterThan(0);
    await act(async () => tree.unmount());
  });

  it('offers Cancel and Show QR Code, and the purple button asks who it is first', async () => {
    const tree = await mount();
    const cancel = tree.root.findAll((n) => n.props.accessibilityLabel === 'Cancel');
    const show = tree.root
      .findAll((n) => n.props.accessibilityLabel === 'Show QR Code' && typeof n.props.onPress === 'function');
    expect(cancel.length).toBeGreaterThan(0);
    expect(show.length).toBeGreaterThan(0);
    expect(texts(tree)).toContain('Show QR Code');

    await act(async () => {
      await show[0].props.onPress();
    });
    await settle();
    // Presence is proven before a code can exist, exactly as before the redesign.
    expect(authenticateForPairing).toHaveBeenCalledTimes(1);
    expect(tree.root.findAll((n) => n.props.testID === 'qr')).toHaveLength(0);
    await act(async () => tree.unmount());
  });
});
