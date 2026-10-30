/**
 * The recovery phrase has to be REAL on screen, not just in the core:
 * created wallets show twelve BIP-39 words once, refuse to continue until the
 * user proves they wrote them down, and store nothing on a back-out. Imports
 * reject a phrase whose checksum does not hold.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      mode: 'dark',
      ink: '#FFFFFF',
      inkMuted: '#9AA0B4',
      background: '#0B0B12',
      surface: '#15151F',
      border: '#262637',
      brand: '#6C63FF',
      positive: '#158444',
      buttonGradient: ['#6C63FF', '#4A90D9'],
      onBrand: '#FFFFFF',
      negative: '#D63232',
    },
  }),
}));

jest.mock('../src/core/storage/secureStorage', () => {
  const actual = jest.requireActual('../src/core/storage/secureStorage');
  return { ...actual, storeSeed: jest.fn(async () => undefined) };
});

import * as SecureStorage from '../src/core/storage/secureStorage';
import { validateMnemonic } from '../src/core/wallet/bip39';
import RecoveryPhraseScreen from '../src/screens/onboarding/RecoveryPhraseScreen';
import ImportWalletScreen from '../src/screens/wallet/ImportWalletScreen';

const storeSeed = SecureStorage.storeSeed as unknown as jest.Mock;

const wrap = (children: React.ReactNode) =>
  renderer.create(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 411, height: 891 },
        insets: { top: 24, left: 0, right: 0, bottom: 16 },
      }}
    >
      {children}
    </SafeAreaProvider>,
  );

const texts = (t: renderer.ReactTestRenderer): string[] => {
  const out: string[] = [];
  const walk = (node: any) => {
    if (typeof node === 'string' || typeof node === 'number') out.push(String(node));
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node?.children) walk(node.children);
  };
  walk(t.toJSON());
  return out;
};

const press = async (t: renderer.ReactTestRenderer, label: string) => {
  const targets = t.root.findAll(
    (n: any) => typeof n.props?.onPress === 'function' && textsIn(n).includes(label),
  );
  if (!targets.length) throw new Error(`no pressable with "${label}"`);
  await act(async () => targets[0].props.onPress());
};

const textsIn = (n: any): string[] => {
  const out: string[] = [];
  const walk = (node: any) => {
    if (typeof node === 'string' || typeof node === 'number') out.push(String(node));
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node?.children) walk(node.children);
  };
  walk(n.children);
  return out;
};

describe('creating a wallet shows a real phrase once', () => {
  beforeEach(() => storeSeed.mockClear());

  it('reveals twelve valid BIP-39 words, quizzes three of them, then stores that exact phrase', async () => {
    const onDone = jest.fn();
    let t!: renderer.ReactTestRenderer;
    await act(async () => {
      t = wrap(<RecoveryPhraseScreen onBack={() => {}} onDone={onDone} />);
    });

    // Gate first: no words exist in the tree at all.
    expect(texts(t).join(' ')).toMatch(/recovery phrase/i);
    expect(t.root.findAll((n: any) => n.props?.testID === 'phraseWord0')).toHaveLength(0);

    // Tick both acknowledgements, then ask to see the phrase.
    const acks = t.root.findAll(
      (n: any) => typeof n.props?.onPress === 'function' && textsIn(n).join(' ').startsWith('I understand'),
    );
    expect(acks.length).toBe(2);
    for (const box of acks) await act(async () => box.props.onPress());
    await press(t, 'Show my phrase');

    // Twelve real words that pass BIP-39.
    const words = Array.from({ length: 12 }, (_, i) =>
      t.root.find((n: any) => n.props?.testID === `phraseWord${i}`).props.children as string,
    );
    const phrase = words.join(' ');
    expect(validateMnemonic(phrase).ok).toBe(true);

    // Blurred until asked.
    expect(texts(t).join(' ')).toContain('Tap to reveal');
    const reveal = t.root.find((n: any) => n.props?.testID === 'phraseReveal');
    await act(async () => reveal.props.onPress());
    expect(texts(t).join(' ')).not.toContain('Tap to reveal');
    expect(storeSeed).not.toHaveBeenCalled();

    await press(t, "I've written it down");

    // Quiz: work out which three positions are being asked, answer from `words`.
    const inputs = new Map<string, any>();
    for (const n of t.root.findAll(
      (node: any) => typeof node.props?.testID === 'string' && /^phraseAnswer\d$/.test(node.props.testID),
    )) {
      if (typeof n.props?.onChangeText === 'function' && !inputs.has(n.props.testID)) {
        inputs.set(n.props.testID, n);
      }
    }
    expect(inputs.size).toBe(3);

    const askedIndexes: number[] = [];
    const flat = texts(t).join('');
    for (const chunk of flat.match(/Word #(\d+)/g) ?? []) {
      const index = Number(chunk.replace('Word #', ''));
      if (!askedIndexes.includes(index)) askedIndexes.push(index);
    }
    expect(askedIndexes.length).toBe(3);

    for (const [testID, input] of inputs) {
      const slot = Number(testID.replace('phraseAnswer', ''));
      await act(async () => input.props.onChangeText(words[askedIndexes[slot] - 1]));
    }
    await press(t, 'Finish');
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 50));
    });

    expect(storeSeed).toHaveBeenCalledTimes(1);
    expect(storeSeed).toHaveBeenCalledWith(phrase);
    expect(onDone).toHaveBeenCalled();
  });

  it('does not store anything when the user backs out', async () => {
    const onBack = jest.fn();
    let t!: renderer.ReactTestRenderer;
    await act(async () => {
      t = wrap(<RecoveryPhraseScreen onBack={onBack} onDone={() => {}} />);
    });
    const back = t.root.find((n: any) => n.props?.testID === 'phraseBack');
    await act(async () => back.props.onPress());
    expect(onBack).toHaveBeenCalled();
    expect(storeSeed).not.toHaveBeenCalled();
  });
});

describe('importing a wallet checks the phrase', () => {
  beforeEach(() => storeSeed.mockClear());

  const type = async (t: renderer.ReactTestRenderer, value: string) => {
    const input = t.root.find((n: any) => n.props?.testID === 'importPhraseInput');
    await act(async () => input.props.onChangeText(value));
  };

  it('rejects a twelve-word phrase that is not a real BIP-39 phrase', async () => {
    let t!: renderer.ReactTestRenderer;
    const nav = { replace: jest.fn(), goBack: jest.fn() };
    await act(async () => {
      t = wrap(<ImportWalletScreen navigation={nav} />);
    });

    await type(t, 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon');
    const body = texts(t).join(' ');
    expect(body).not.toContain('phrase checks out');
    expect(storeSeed).not.toHaveBeenCalled();
  });

  it('accepts an official test-vector phrase and stores it verbatim', async () => {
    const vector = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
    expect(validateMnemonic(vector).ok).toBe(true);

    let t!: renderer.ReactTestRenderer;
    const nav = { replace: jest.fn(), goBack: jest.fn() };
    await act(async () => {
      t = wrap(<ImportWalletScreen navigation={nav} />);
    });

    await type(t, vector);
    expect(texts(t).join(' ')).toContain('phrase checks out');

    await press(t, 'Continue');
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 700));
    });
    expect(storeSeed).toHaveBeenCalledTimes(1);
    expect(storeSeed).toHaveBeenCalledWith(vector);
  });
});
