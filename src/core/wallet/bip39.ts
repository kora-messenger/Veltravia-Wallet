/**
 * Veltravia Wallet — BIP-39 recovery phrases, for real.
 *
 * Before this file the app accepted ANY 12 or 24 words and stored nothing, so
 * "your wallet" had no phrase behind it. This implements the BIP-39 spec
 * (mnemonic ↔ entropy + checksum) with SHA-256 from ./crypto/hash, which is
 * itself checked against the FIPS-180 test vectors.
 *
 * Scope, stated honestly:
 *   • Generation uses the platform CSPRNG and refuses to run without one — a
 *     phrase is the wallet, so it must never come from Math.random.
 *   • Validation is the real BIP-39 checksum, not a word count.
 *   • Deriving ADDRESSES is not here: that needs secp256k1/BIP-32 (WalletCore or
 *     a dedicated library), which this build does not ship. A phrase created
 *     here is a real, restorable wallet; it will produce addresses the moment
 *     the derivation bridge lands.
 */

import { secureRandomBytes, sha256 } from '../crypto/hash';
import { BIP39_ENGLISH } from './bip39Wordlist';

export type MnemonicStrength = 128 | 160 | 192 | 224 | 256;

const WORD_INDEX: Map<string, number> = (() => {
  const m = new Map<string, number>();
  BIP39_ENGLISH.forEach((w, i) => m.set(w, i));
  return m;
})();

/** Which phrase lengths we accept, by word count. */
export const VALID_WORD_COUNTS = [12, 15, 18, 21, 24] as const;

function toBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }
  return bits;
}

function fromBits(bits: number[]): Uint8Array {
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i * 8 + j] ?? 0);
    out[i] = byte;
  }
  return out;
}

/** entropy -> phrase. Deterministic; the spec's core. */
export function entropyToMnemonic(entropy: Uint8Array): string {
  if (![16, 20, 24, 28, 32].includes(entropy.length)) {
    throw new Error('BIP-39 entropy must be 16, 20, 24, 28 or 32 bytes');
  }
  const entBits = toBits(entropy);
  const checksumBits = toBits(sha256(entropy)).slice(0, entropy.length / 4);
  const bits = [...entBits, ...checksumBits];
  const words: string[] = [];
  for (let i = 0; i < bits.length; i += 11) {
    let idx = 0;
    for (let j = 0; j < 11; j++) idx = (idx << 1) | bits[i + j];
    words.push(BIP39_ENGLISH[idx]);
  }
  return words.join(' ');
}

/**
 * phrase -> entropy, or null when the phrase is not a valid BIP-39 mnemonic
 * (unknown word, wrong length, or checksum mismatch).
 */
export function mnemonicToEntropy(phrase: string): Uint8Array | null {
  const words = normalizeMnemonic(phrase).split(' ').filter(Boolean);
  if (!(VALID_WORD_COUNTS as readonly number[]).includes(words.length)) return null;

  const bits: number[] = [];
  for (const w of words) {
    const idx = WORD_INDEX.get(w);
    if (idx === undefined) return null;
    for (let j = 10; j >= 0; j--) bits.push((idx >> j) & 1);
  }
  const csLen = bits.length / 33;
  const entBits = bits.slice(0, bits.length - csLen);
  const givenCs = bits.slice(bits.length - csLen);
  const entropy = fromBits(entBits);
  const wantCs = toBits(sha256(entropy)).slice(0, csLen);
  return givenCs.every((b, i) => b === wantCs[i]) ? entropy : null;
}

export type PhraseProblem =
  | { ok: true; words: number }
  | { ok: false; reason: 'empty' | 'count' | 'unknown-word' | 'checksum'; detail?: string };

/** Full check for the UI: says WHY a phrase is not usable. */
export function validateMnemonic(phrase: string): PhraseProblem {
  const words = normalizeMnemonic(phrase).split(' ').filter(Boolean);
  if (words.length === 0) return { ok: false, reason: 'empty' };
  if (!(VALID_WORD_COUNTS as readonly number[]).includes(words.length)) {
    return { ok: false, reason: 'count', detail: String(words.length) };
  }
  const unknown = words.find((w) => !WORD_INDEX.has(w));
  if (unknown) return { ok: false, reason: 'unknown-word', detail: unknown };
  if (!mnemonicToEntropy(phrase)) return { ok: false, reason: 'checksum' };
  return { ok: true, words: words.length };
}

/** Trim, lowercase, collapse whitespace. Typed and pasted phrases differ wildly. */
export function normalizeMnemonic(input: string): string {
  return (input ?? '')
    .replace(/[\u2018\u2019\u00b4`]/g, "'")
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** A fresh phrase from the platform CSPRNG. 128 bits = 12 words by default. */
export function generateMnemonic(strength: MnemonicStrength = 128): string {
  if (![128, 160, 192, 224, 256].includes(strength)) {
    throw new Error('BIP-39 strength must be 128, 160, 192, 224 or 256 bits');
  }
  const phrase = entropyToMnemonic(secureRandomBytes(strength / 8));
  if (!mnemonicToEntropy(phrase)) {
    // Cannot happen unless the wordlist is corrupt; refuse rather than show it.
    throw new Error('Generated phrase failed its own checksum');
  }
  return phrase;
}

/** Word positions a confirm-quiz can offer, without revealing the phrase. */
export function quizPositions(words: number, count = 3): number[] {
  const picked = new Set<number>();
  while (picked.size < Math.min(count, words)) {
    const idx = secureRandomBytes(1)[0] % words;
    picked.add(idx);
  }
  return [...picked].sort((a, b) => a - b);
}
