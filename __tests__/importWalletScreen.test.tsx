/**
 * "Multi-coin wallet" restore screen: the Trust layout, with real BIP-39 checks
 * underneath. Nothing is stored unless the phrase validates.
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
    resetGenericPassword: jest.fn(async (opts: any) => { store.delete(opts?.service); return true; }),
    __store: store,
  };
});

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      mode: 'dark', ink: '#fff', inkMuted: '#999', background: '#000',
      surface: '#111', surfaceAlt: '#1a1a2e', border: '#222', brand: '#6C63FF',
      negative: '#D63232', positive: '#158444',
    },
  }),
}));

jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));

const mockPaste = jest.fn(async () => '');
jest.mock('../src/core/clipboard', () => ({
  copyToClipboard: jest.fn(() => true),
  pasteFromClipboard: () => mockPaste(),
}));

const mockCreateWallet = jest.fn();
jest.mock('../src/wallets/WalletsProvider', () => ({
  useWallets: () => ({ nextWalletName: () => 'Wallet 2', createWallet: mockCreateWallet }),
}));

import ImportWalletScreen from '../src/screens/wallet/ImportWalletScreen';
import { readSeed } from '../src/core/storage/secureStorage';

const VECTOR = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

const navigation = { goBack: jest.fn(), navigate: jest.fn(), reset: jest.fn() };

const mount = () => {
  let tree: any;
  act(() => {
    tree = renderer.create(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 411, height: 891 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}
      >
        <ImportWalletScreen navigation={navigation} />
      </SafeAreaProvider>,
    );
  });
  return tree;
};

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

const byTestId = (t: any, id: string) =>
  t.root.findAll((n: any) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0];

const anyByTestId = (t: any, id: string) =>
  t.root.findAll((n: any) => n.props?.testID === id)[0];

const typePhrase = async (t: any, value: string) => {
  const input = t.root.findAll((n: any) => n.props?.testID === 'importPhraseInput' && n.props?.onChangeText)[0];
  await act(async () => input.props.onChangeText(value));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPaste.mockResolvedValue('');
});

describe('Multi-coin wallet restore', () => {
  it('lays the screen out the way Trust does', () => {
    const t = mount();
    const shown = texts(t);
    expect(shown).toContain('Multi-coin wallet');
    expect(shown).toContain('Wallet name');
    expect(shown).toContain('Secret phrase');
    expect(shown).toContain('Paste');
    expect(shown).toContain('Typically 12 (sometimes 18, 24) words separated by single spaces');
    expect(shown).toContain('Restore wallet');
    expect(shown).toContain('What is a secret phrase?');
    // The name field starts on the next free wallet name, like Trust.
    expect(t.root.findAll((n: any) => n.props?.testID === 'importNameInput')[0].props.value).toBe('Wallet 2');
  });

  it('will not restore a phrase that fails its checksum', async () => {
    const t = mount();
    await typePhrase(t, VECTOR.replace('yellow', 'legal'));
    // Words are all real this time, so only the checksum can catch it.
    expect(texts(t)).toContain("That phrase doesn't add up. Check the words and their order.");
    expect(anyByTestId(t, 'importPhraseError')).toBeTruthy();
    await act(async () => byTestId(t, 'importRestore').props.onPress());
    expect(await readSeed()).toBeNull();
    expect(mockCreateWallet).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('restores a real phrase, names the wallet and lands on the home tabs', async () => {
    const t = mount();
    await typePhrase(t, `  ${VECTOR.toUpperCase()}  `);
    expect(anyByTestId(t, 'importPhraseOk')).toBeTruthy();

    await act(async () => byTestId(t, 'importRestore').props.onPress());
    expect(await readSeed()).toBe(VECTOR);
    expect(mockCreateWallet).toHaveBeenCalledWith('Wallet 2', 'default', 'violet', 'imported');
    expect(navigation.reset).toHaveBeenCalled();
  });

  it('pastes from the clipboard into the box', async () => {
    mockPaste.mockResolvedValue(VECTOR);
    const t = mount();
    await act(async () => byTestId(t, 'importPaste').props.onPress());
    const input = t.root.findAll((n: any) => n.props?.testID === 'importPhraseInput' && n.props?.value !== undefined)[0];
    expect(input.props.value).toBe(VECTOR);
  });

  it('says nothing while the user is still typing the first word', async () => {
    const t = mount();
    await typePhrase(t, 'legal win');
    expect(t.root.findAll((n: any) => n.props?.testID === 'importPhraseError')).toHaveLength(0);
  });
});
