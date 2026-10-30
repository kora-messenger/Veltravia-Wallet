/**
 * The recovery phrase has to be a REAL BIP-39 wallet, not 12 random words.
 * These are the official test vectors from the BIP-39 repository, so the
 * implementation is checked against the specification rather than against
 * itself.
 */
import {
  entropyToMnemonic,
  generateMnemonic,
  mnemonicToEntropy,
  normalizeMnemonic,
  quizPositions,
  validateMnemonic,
} from '../src/core/wallet/bip39';
import { fromHex, secureRandomBytes, toHex } from '../src/core/crypto/hash';
import { BIP39_ENGLISH } from '../src/core/wallet/bip39Wordlist';

describe('the vendored wordlist', () => {
  it('is the official list: 2048 unique lowercase words, abandon … zoo', () => {
    expect(BIP39_ENGLISH).toHaveLength(2048);
    expect(new Set(BIP39_ENGLISH).size).toBe(2048);
    expect(BIP39_ENGLISH[0]).toBe('abandon');
    expect(BIP39_ENGLISH[2047]).toBe('zoo');
    expect(BIP39_ENGLISH.every((w) => /^[a-z]+$/.test(w))).toBe(true);
  });
});

describe('BIP-39 vectors (official)', () => {
  const VECTORS: Array<[string, string]> = [
    [
      '00000000000000000000000000000000',
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    ],
    [
      '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
      'legal winner thank year wave sausage worth useful legal winner thank yellow',
    ],
    [
      '80808080808080808080808080808080',
      'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
    ],
    [
      'ffffffffffffffffffffffffffffffff',
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
    ],
    [
      '0000000000000000000000000000000000000000000000000000000000000000',
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
    ],
  ];

  it.each(VECTORS)('entropy %s → phrase', (entropyHex, phrase) => {
    expect(entropyToMnemonic(fromHex(entropyHex))).toBe(phrase);
    // and back again, so a restored phrase yields the same entropy
    expect(toHex(mnemonicToEntropy(phrase)!)).toBe(entropyHex);
    expect(validateMnemonic(phrase)).toEqual({ ok: true, words: phrase.split(' ').length });
  });
});

describe('a phrase that is wrong is refused, and says why', () => {
  it('rejects a valid-looking phrase with one word swapped (checksum)', () => {
    const broken = 'legal winner thank year wave sausage worth useful legal winner thank zoo';
    expect(validateMnemonic(broken)).toEqual({ ok: false, reason: 'checksum' });
    expect(mnemonicToEntropy(broken)).toBeNull();
  });

  it('rejects a word that is not in the list', () => {
    const res = validateMnemonic('legal winner thank year wave sausage worth useful legal winner thank bananas');
    expect(res).toEqual({ ok: false, reason: 'unknown-word', detail: 'bananas' });
  });

  it('rejects the wrong number of words', () => {
    expect(validateMnemonic('abandon abandon abandon')).toMatchObject({ ok: false, reason: 'count' });
    expect(validateMnemonic('')).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('rejects the old "any 12 words will do" phrase that used to be accepted', () => {
    const nonsense = Array(12).fill('hello').join(' ');
    expect(validateMnemonic(nonsense)).toMatchObject({ ok: false });
  });
});

describe('typing and pasting behave', () => {
  it('normalises case, extra spaces and punctuation before validating', () => {
    const messy = '  Legal   WINNER thank year wave sausage worth useful legal winner thank yellow. ';
    expect(normalizeMnemonic(messy)).toBe(
      'legal winner thank year wave sausage worth useful legal winner thank yellow',
    );
    expect(validateMnemonic(messy).ok).toBe(true);
  });

  it('accepts 24-word phrases too', () => {
    const phrase = entropyToMnemonic(fromHex('0000000000000000000000000000000000000000000000000000000000000000'));
    expect(validateMnemonic(phrase)).toEqual({ ok: true, words: 24 });
  });
});

describe('generation', () => {
  it('produces a phrase that validates, for every supported strength', () => {
    for (const [strength, words] of [
      [128, 12],
      [160, 15],
      [192, 18],
      [224, 21],
      [256, 24],
    ] as const) {
      const phrase = generateMnemonic(strength);
      expect(phrase.split(' ')).toHaveLength(words);
      expect(validateMnemonic(phrase)).toEqual({ ok: true, words });
    }
  });

  it('never repeats the same phrase', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateMnemonic());
    expect(seen.size).toBe(50);
  });

  it('refuses to invent a phrase when the platform has no CSPRNG', () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const real = g.crypto;
    delete g.crypto;
    try {
      expect(() => generateMnemonic()).toThrow(/CSPRNG/);
      expect(() => secureRandomBytes(16)).toThrow(/CSPRNG/);
    } finally {
      Object.defineProperty(g, 'crypto', { value: real, configurable: true });
    }
  });

  it('picks quiz positions inside the phrase, without repeats', () => {
    const picks = quizPositions(12, 3);
    expect(picks).toHaveLength(3);
    expect(new Set(picks).size).toBe(3);
    expect(picks.every((i) => i >= 0 && i < 12)).toBe(true);
  });
});
