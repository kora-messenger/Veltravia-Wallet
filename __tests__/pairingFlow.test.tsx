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

jest.mock('../src/components/AppModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible, children }: any) => (visible ? React.createElement(View, null, children) : null);
});

import SelectRecoveryMethodScreen from '../src/screens/SelectRecoveryMethodScreen';
import PairingCodeSheet from '../src/components/PairingCodeSheet';
import { parseQr } from '../src/services/qrParse';
import { buildPairingPayload, deriveSeedGroup } from '../src/core/security/walletGroup';

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

describe('the code sheet an existing device shows', () => {
  it('renders a live code with a countdown, and never the phrase', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PairingCodeSheet visible onClose={jest.fn()} />);
    });
    expect(tree.root.findAll((n) => n.props.testID === 'pairingCodeSheet').length).toBeGreaterThan(0);
    const timer = tree.root.findAll((n) => n.props.testID === 'pairingTimer')[0];
    expect(String(timer.props.children)).toMatch(/Expires in \d+:\d\d/);

    // the QrCode receives the pairing URI, which carries the group but not the seed
    const qr = tree.root.findAll((n) => typeof n.props.value === 'string' && n.props.value.startsWith('veltravia-pair://'));
    expect(qr.length).toBeGreaterThan(0);
    expect(String(qr[0].props.value)).not.toContain('legal winner');
    await act(async () => { tree.unmount(); });
  });
});

describe('the code itself', () => {
  it('is classified as a pairing code, not a plain link', () => {
    const { groupId, key } = deriveSeedGroup('some phrase');
    const uri = buildPairingPayload({ groupId, key, createdAt: 1, devices: [{ id: 'aabbccdd', name: 'Pixel', addedAt: 1 }] });
    const parsed = parseQr(uri);
    expect(parsed.kind).toBe('pairing');
    expect(parsed.label).toBe('Pair this device');
  });

  it('never carries the seed', () => {
    const seed = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
    const { groupId, key } = deriveSeedGroup(seed);
    const uri = buildPairingPayload({ groupId, key, createdAt: 1, devices: [] });
    expect(uri).not.toContain(seed);
    expect(uri).not.toContain('legal');
  });
});
