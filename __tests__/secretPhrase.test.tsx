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
      surfaceAlt: '#1a1a2e',
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

const mount = (onBack: () => void = () => {}) =>
  renderer.create(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 411, height: 891 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}
    >
      <SecretPhraseScreen onBack={onBack} />
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

const byId = (t: any, id: string) =>
  t.root.findAll((n: any) => n.props?.testID === id && typeof n.props?.onPress === 'function');
const press = async (t: any, id: string) => {
  const hit = byId(t, id);
  if (!hit.length) throw new Error(`nothing pressable with testID ${id}`);
  await act(async () => hit[0].props.onPress());
};
const present = (t: any, id: string) => t.root.findAll((n: any) => n.props?.testID === id).length > 0;

describe('the secret phrase screen, as in the current Trust build', () => {
  beforeEach(async () => {
    await require('react-native-keychain').__store.clear?.();
    mockCopy.mockClear();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('opens with the words concealed, and nothing readable in the tree', async () => {
    await walletManager.importWallet(VECTOR);
    let t: any;
    await act(async () => {
      t = mount();
      await Promise.resolve();
    });
    expect(present(t, 'phraseConcealed')).toBe(true);
    expect(present(t, 'phraseWord0')).toBe(false);
    expect(texts(t)).toContain('12 words');
    expect(texts(t)).not.toContain('legal');
  });

  it('Show opens the safety popup first, and the words appear only after "I understand"', async () => {
    await walletManager.importWallet(VECTOR);
    let t: any;
    await act(async () => {
      t = mount();
      await Promise.resolve();
    });

    await press(t, 'phraseShow');
    expect(present(t, 'phraseIntroUnderstand')).toBe(true);
    // Popup is up but the words are still hidden behind it.
    expect(present(t, 'phraseWord0')).toBe(false);

    await press(t, 'phraseIntroUnderstand');
    expect(present(t, 'phraseWord0')).toBe(true);
    const shown = VECTOR.split(' ').map((_, i) =>
      t.root.find((n: any) => n.props?.testID === `phraseWord${i}`).props.children,
    );
    expect(shown.join(' ')).toBe(VECTOR);
  });

  it('closing the popup with X reveals nothing', async () => {
    await walletManager.importWallet(VECTOR);
    let t: any;
    await act(async () => {
      t = mount();
      await Promise.resolve();
    });
    await press(t, 'phraseShow');
    await press(t, 'phraseIntroClose');
    expect(present(t, 'phraseWord0')).toBe(false);
  });

  it('Done stays dead until "I\'ve already backed this up" is ticked', async () => {
    await walletManager.importWallet(VECTOR);
    const back = jest.fn();
    let t: any;
    await act(async () => {
      t = mount(back);
      await Promise.resolve();
    });
    const done = () => t.root.find((n: any) => n.props?.testID === 'phraseDone');
    expect(done().props.disabled).toBe(true);
    await act(async () => done().props.onPress?.());
    act(() => jest.advanceTimersByTime(2000));
    expect(back).not.toHaveBeenCalled();
  });

  it('tick, Done: a spinner shows at the button corner, then it returns to Manage account', async () => {
    await walletManager.importWallet(VECTOR);
    const back = jest.fn();
    let t: any;
    await act(async () => {
      t = mount(back);
      await Promise.resolve();
    });

    await press(t, 'phraseBackedUp');
    const done = () => t.root.find((n: any) => n.props?.testID === 'phraseDone');
    expect(done().props.disabled).toBe(false);
    expect(present(t, 'phraseDoneSpinner')).toBe(false);

    await press(t, 'phraseDone');
    expect(present(t, 'phraseDoneSpinner')).toBe(true);
    expect(back).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(back).toHaveBeenCalledTimes(1);

    // A second tap during the spinner must not queue a second navigation.
    await press(t, 'phraseDone').catch(() => {});
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('copies the phrase as sensitive once it is visible', async () => {
    await walletManager.importWallet(VECTOR);
    let t: any;
    await act(async () => {
      t = mount();
      await Promise.resolve();
    });
    await press(t, 'phraseShow');
    await press(t, 'phraseIntroUnderstand');
    await press(t, 'phraseCopy');
    expect(mockCopy).toHaveBeenCalledWith(VECTOR, { sensitive: true });
  });

  it('says so plainly when this device holds no phrase', async () => {
    let t: any;
    await act(async () => {
      t = mount();
      await Promise.resolve();
    });
    expect(texts(t)).toMatch(/no secret phrase|not stored|No secret phrase/i);
    expect(present(t, 'phraseWord0')).toBe(false);
  });
});
