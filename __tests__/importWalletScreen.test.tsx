/**
 * "Restore wallet": the Trust layout the user specified, with real BIP-39 checks
 * underneath. Continue must never enable on a phrase that does not validate.
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
      return v === undefined ? false : { username: 'x', password: v };
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
      inkMuted: '#8E96AD',
      background: '#02070E',
      surface: '#07101E',
      surfaceAlt: '#0D1626',
      border: '#121C2E',
      brand: '#6C63FF',
      negative: '#D63232',
      buttonGradient: ['#6C63FF', '#4A90D9'],
    },
  }),
}));

const mockCreateWallet = jest.fn();
jest.mock('../src/wallets/WalletsProvider', () => ({
  useWallets: () => ({ nextWalletName: () => 'Main Wallet 1', createWallet: mockCreateWallet }),
}));

const mockPaste = jest.fn(async () => '');
jest.mock('../src/core/clipboard', () => ({
  copyToClipboard: jest.fn(() => true),
  pasteFromClipboard: () => mockPaste(),
}));

const scanTargets: Array<(v: string) => Promise<void>> = [];
const purposes: any[] = [];
jest.mock('../src/services/scanTarget', () => ({
  registerScanTarget: (fn: any, _close: any, purpose: any) => {
    scanTargets.push(fn);
    purposes.push(purpose);
    return jest.fn();
  },
}));

import ImportWalletScreen from '../src/screens/wallet/ImportWalletScreen';
import { readSeed } from '../src/core/storage/secureStorage';

const VECTOR = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

const PAIR_CODE =
  'veltravia-pair://2?s=' +
  'a'.repeat(32) +
  '&p=' +
  'b'.repeat(64) +
  '&e=' +
  String(Date.now() + 5 * 60 * 1000);

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

const byId = (t: any, id: string) => t.root.findAll((n: any) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0];
const anyById = (t: any, id: string) => t.root.findAll((n: any) => n.props?.testID === id)[0];

const typePhrase = async (t: any, value: string) => {
  const input = anyById(t, 'restorePhraseInput');
  await act(async () => input.props.onChangeText(value));
};

beforeEach(() => {
  mockCreateWallet.mockClear();
  navigation.reset.mockClear();
  navigation.navigate.mockClear();
  mockPaste.mockClear();
});

describe('Restore wallet', () => {
  it('leads with the 3D art, the Restore Wallet headline and the two cards', () => {
    const t = mount();
    const shown = texts(t);
    // "Wallet" is drawn with the brand gradient, so it is its own node
    expect(shown).toContain('Restore ');
    // texts() walks letters individually in places, so normalise the spacing
    const flat = Array.from(shown as any).join('').replace(/\s+/g, ' ');
    expect(flat).toContain('Enter your secret phrase to restore your wallet');
    for (const line of ['Secret phrase', 'Keep your phrase safe', 'Paste', 'Continue']) {
      expect(flat).toContain(line);
    }
    expect(anyById(t, 'restoreBack')).toBeTruthy();
    expect(anyById(t, 'restoreScan')).toBeTruthy();
    expect(anyById(t, 'restorePhraseInput').props.placeholder).toBe('Enter secret phrase');
    // the art is bundled, not a remote URL
    const img = t.root.findAll((n: any) => n.props.style && JSON.stringify(n.props.style).includes('"height":154'));
    expect(img.length).toBeGreaterThan(0);
  });

  it('keeps the Paste row, with the eye always in the field and Clear once typed', async () => {
    const t = mount();
    expect(anyById(t, 'restorePaste')).toBeTruthy();
    // the eye lives in the input field, so it is there before any typing
    expect(byId(t, 'restoreHide').props.accessibilityLabel).toBe('Hide secret phrase');
    expect(anyById(t, 'restoreClear')).toBeUndefined();

    await typePhrase(t, 'legal winner');

    expect(byId(t, 'restoreClear')).toBeTruthy();
    expect(texts(t)).toContain('Clear');
  });

  it('the eye masks the words and brings them back', async () => {
    const t = mount();
    await typePhrase(t, VECTOR);

    await act(async () => byId(t, 'restoreHide').props.onPress());
    const masked = anyById(t, 'restorePhraseInput').props.value as string;
    expect(masked).not.toContain('legal');
    // Masked per word, spacing and word count preserved.
    expect(masked.split(' ').every((w) => /^•+$/.test(w))).toBe(true);
    expect(masked.split(' ')).toHaveLength(VECTOR.split(' ').length);
    expect(byId(t, 'restoreHide').props.accessibilityLabel).toBe('Show secret phrase');

    await act(async () => byId(t, 'restoreHide').props.onPress());
    expect(anyById(t, 'restorePhraseInput').props.value).toBe(VECTOR);
    expect(byId(t, 'restoreHide').props.accessibilityLabel).toBe('Hide secret phrase');
  });

  it('Clear empties the box and brings Paste back', async () => {
    const t = mount();
    await typePhrase(t, VECTOR);
    await act(async () => byId(t, 'restoreClear').props.onPress());

    expect(anyById(t, 'restorePhraseInput').props.value).toBe('');
    expect(anyById(t, 'restorePaste')).toBeTruthy();
    expect(anyById(t, 'restoreClear')).toBeUndefined();
    expect(anyById(t, 'restorePhraseInput').props.value).toBe('');
  });

  it('keeps Continue disabled until the phrase actually validates', async () => {
    const t = mount();
    expect(byId(t, 'restoreContinue').props.disabled).toBe(true);

    await typePhrase(t, VECTOR.replace('yellow', 'legal')); // words real, checksum wrong
    expect(byId(t, 'restoreContinue').props.disabled).toBe(true);
    expect(texts(t)).toContain("That phrase doesn't add up. Check the words and their order.");

    await typePhrase(t, VECTOR);
    expect(byId(t, 'restoreContinue').props.disabled).toBe(false);
  });

  it('restores a valid phrase: stores it, names the wallet, lands on the home tabs', async () => {
    const t = mount();
    await typePhrase(t, VECTOR);
    await act(async () => byId(t, 'restoreContinue').props.onPress());

    expect(await readSeed()).toBe(VECTOR);
    expect(mockCreateWallet).toHaveBeenCalledWith('Main Wallet 1', 'default', 'violet', 'imported');
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainTabs' }] });
  });

  it('Paste fills the box and re-enables Continue for a good phrase', async () => {
    mockPaste.mockResolvedValueOnce(VECTOR);
    const t = mount();
    await act(async () => byId(t, 'restorePaste').props.onPress());

    expect(anyById(t, 'restorePhraseInput').props.value).toBe(VECTOR);
    expect(byId(t, 'restoreContinue').props.disabled).toBe(false);
  });

  it('scan job 1: a secret phrase lands in the box for review, not a straight restore', async () => {
    const t = mount();
    await act(async () => byId(t, 'restoreScan').props.onPress());
    expect(scanTargets.length).toBeGreaterThan(0);
    expect(navigation.navigate).toHaveBeenCalledWith('ScanQr');

    await act(async () => scanTargets[scanTargets.length - 1](VECTOR));
    expect(anyById(t, 'restorePhraseInput').props.value).toBe(VECTOR);
    expect(byId(t, 'restoreContinue').props.disabled).toBe(false);
    // Scanning fills the box; it never restores by itself.
    expect(mockCreateWallet).not.toHaveBeenCalled();
  });

  it('scan job 2: a pairing code goes to the verify screen instead of the phrase box', async () => {
    const t = mount();
    await act(async () => byId(t, 'restoreScan').props.onPress());

    await act(async () => scanTargets[scanTargets.length - 1](PAIR_CODE));
    expect(navigation.navigate).toHaveBeenCalledWith('PairVerify', { uri: PAIR_CODE });
    expect(anyById(t, 'restorePhraseInput').props.value).toBe('');
  });

  it('refuses a code that is neither, and keeps scanning', async () => {
    const t = mount();
    await act(async () => byId(t, 'restoreScan').props.onPress());
    const target = scanTargets[scanTargets.length - 1];

    // The screen's own accept check refuses it, before the handler ever runs.
    const purpose = purposes[purposes.length - 1];
    expect(purpose.accept('ethereum:0x123')).toEqual({
      ok: false,
      reason: "That QR code isn't a secret phrase or a pairing code.",
    });
    expect(purpose.accept(VECTOR)).toEqual({ ok: true, value: VECTOR });
    expect(purpose.accept(PAIR_CODE)).toEqual({ ok: true, value: PAIR_CODE });
    expect(anyById(t, 'restorePhraseInput').props.value).toBe('');
    expect(navigation.navigate).toHaveBeenCalledTimes(1); // only the ScanQr trip

    // Still armed after a refusal: a real phrase is accepted next.
    await act(async () => target(VECTOR));
    expect(anyById(t, 'restorePhraseInput').props.value).toBe(VECTOR);
  });
});
