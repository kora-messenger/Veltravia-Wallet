/**
 * The secret phrase is generated when the wallet is created, and shown on demand
 * on the Trust path (Manage account → Show secret phrase → gate → passcode).
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('react-native-keychain', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    ACCESS_CONTROL: { BIOMETRY_CURRENT_SET: 'bio' },
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'a', WHEN_UNLOCKED: 'b' },
    setGenericPassword: jest.fn(async (_u: string, value: string, opts: any) => {
      store.set(opts?.service, value);
      return true;
    }),
    getGenericPassword: jest.fn(async (opts: any) => {
      const v = store.get(opts?.service);
      return v === undefined ? false : { username: 'x', password: v, service: opts?.service };
    }),
    resetGenericPassword: jest.fn(async (opts: any) => {
      store.delete(opts?.service);
      return true;
    }),
    __store: store,
  };
});

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      mode: 'dark',
      ink: '#fff',
      inkMuted: '#999',
      background: '#000',
      surface: '#111',
      border: '#222',
      brand: '#6C63FF',
      negative: '#D63232',
      buttonGradient: ['#6C63FF', '#4A90D9'],
    },
  }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));

const mockCopy = jest.fn((_text: string, _opts?: any) => true);
jest.mock('../src/core/clipboard', () => ({
  copyToClipboard: (t: string, o?: any) => mockCopy(t, o),
  pasteFromClipboard: jest.fn(async () => ''),
}));

import SecretPhraseScreen from '../src/screens/wallet/SecretPhraseScreen';
import { walletManager } from '../src/core/wallet/walletManager';
import { readSeed } from '../src/core/storage/secureStorage';
import { validateMnemonic } from '../src/core/wallet/bip39';

const VECTOR = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

const mount = () =>
  renderer.create(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 411, height: 891 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}
    >
      <SecretPhraseScreen onBack={() => {}} />
    </SafeAreaProvider>,
  );

const texts = (t: any): string => {
  const out: string[] = [];
  const walk = (n: any) => {
    if (typeof n === 'string' || typeof n === 'number') out.push(String(n));
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && n.children) walk(n.children);
  };
  walk(t.toJSON());
  return out.join('');
};

describe('creating a wallet really creates one', () => {
  beforeEach(async () => {
    await require('react-native-keychain').resetGenericPassword({ service: 'x' });
    await require('react-native-keychain').__store.clear?.();
  });

  it('stores a valid 12-word BIP-39 phrase in the keystore', async () => {
    await walletManager.createWallet();
    const seed = await readSeed();
    expect(seed).toBeTruthy();
    expect(seed!.split(' ')).toHaveLength(12);
    expect(validateMnemonic(seed!).ok).toBe(true);
  });

  it('rejects a phrase whose checksum is wrong, and stores nothing', async () => {
    const bad = VECTOR.replace('yellow', 'yellow'.replace('yellow', 'yacht'));
    expect(await walletManager.importWallet(bad)).toBe(false);
    expect(await readSeed()).toBeNull();
  });

  it('accepts an official vector phrase and stores it normalised', async () => {
    expect(await walletManager.importWallet(`  ${VECTOR.toUpperCase()}  `)).toBe(true);
    expect(await readSeed()).toBe(VECTOR);
  });
});

describe('the reveal screen', () => {
  it('shows the phrase in one box, hides it again, and copies it as sensitive', async () => {
    await walletManager.importWallet(VECTOR);
    let t: any;
    await act(async () => {
      t = mount();
      await Promise.resolve();
    });

    expect(t.root.find((n: any) => n.props?.testID === 'secretPhraseBox')).toBeTruthy();
    expect(t.root.find((n: any) => n.props?.testID === 'secretPhraseText').props.children).toBe(VECTOR);

    const hide = t.root.find((n: any) => n.props?.testID === 'secretPhraseHide' && typeof n.props?.onPress === 'function');
    await act(async () => hide.props.onPress());
    expect(texts(t)).toContain('Phrase hidden');
    expect(t.root.findAll((n: any) => n.props?.testID === 'secretPhraseText')).toHaveLength(0);

    const copy = t.root.find((n: any) => n.props?.testID === 'secretPhraseCopy' && typeof n.props?.onPress === 'function');
    mockCopy.mockClear();
    await act(async () => copy.props.onPress());
    expect(mockCopy).toHaveBeenCalledWith(VECTOR, { sensitive: true });
  });

  it('says so plainly when this device holds no phrase', async () => {
    const keychain = require('react-native-keychain');
    keychain.__store.clear();
    let t: any;
    await act(async () => {
      t = mount();
      await Promise.resolve();
    });
    expect(t.root.find((n: any) => n.props?.testID === 'secretPhraseMissing')).toBeTruthy();
    expect(t.root.findAll((n: any) => n.props?.testID === 'secretPhraseText')).toHaveLength(0);
  });
});
