/**
 * Lock cryptography: correct by test vector, and bound to context.
 *
 * These are the properties the rest of the lock protocol leans on, so they are
 * checked against published material (RFC 5869) rather than against themselves.
 */
import nacl from 'tweetnacl';
import { hkdf, lockKeyCandidates, lockKeyFor, lockKeyV1, lockKeyV2 } from '../src/core/crypto/kdf';
import { fromAscii, fromHex } from '../src/core/crypto/hash';
import { digest } from '../src/core/storage/passcode';
import {
  legacySeal,
  open,
  openFor,
  seal,
  sealFor,
  secureRandomBytes,
} from '../src/core/crypto/groupCrypto';

const SEED = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const GROUP = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const CTX = { groupId: GROUP, kid: 'v2', purpose: 'lock-state' };

describe('HKDF-SHA256 matches RFC 5869 appendix A.1', () => {
  it('produces the published OKM', () => {
    // IKM 0x0b x22, salt 0x000102...0c, info 0xf0..0xf9, L = 42
    const okm = hkdf(
      fromHex('0b'.repeat(22)),
      fromHex('000102030405060708090a0b0c'),
      '\u00f0\u00f1\u00f2\u00f3\u00f4\u00f5\u00f6\u00f7\u00f8\u00f9',
      42,
    );
    expect(okm).toBe(
      '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
    );
  });
});

describe('key separation', () => {
  it('v1 is byte-identical to the derivation existing wallets already hold', () => {
    // If this ever changes, every wallet created before v2 loses its lock state.
    expect(lockKeyV1(SEED)).toBe(digest(SEED, 'veltravia-group-key-v1'));
  });

  it('v2 is a different key from v1 for the same phrase', () => {
    expect(lockKeyV2(SEED, GROUP)).not.toBe(lockKeyV1(SEED));
    expect(lockKeyV2(SEED, GROUP)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('v2 depends on the group id as salt', () => {
    expect(lockKeyV2(SEED, GROUP)).not.toBe(lockKeyV2(SEED, 'ffffffffffffffffffffffffffffffff'));
  });

  it('resolves a key by the id a peer announced', () => {
    expect(lockKeyFor('v1', SEED, GROUP).key).toBe(lockKeyV1(SEED));
    expect(lockKeyFor('v2', SEED, GROUP).key).toBe(lockKeyV2(SEED, GROUP));
    // Unknown id falls back to the preferred scheme rather than throwing.
    expect(lockKeyFor('v9', SEED, GROUP).kid).toBe('v2');
  });

  it('prefers v2 and still offers v1 for legacy wallets', () => {
    const candidates = lockKeyCandidates(SEED, GROUP);
    expect(candidates.map((c) => c.kid)).toEqual(['v2', 'v1']);
    expect(candidates[0].key).toBe(lockKeyV2(SEED, GROUP));
    expect(candidates[1].key).toBe(lockKeyV1(SEED));
  });
});

describe('the sealed box', () => {
  it('round-trips, and refuses a tampered ciphertext', () => {
    const sealed = sealFor(lockKeyV2(SEED, GROUP), JSON.stringify({ locked: true }), CTX);
    expect(sealed.startsWith('sv2.')).toBe(true);
    expect(openFor(lockKeyV2(SEED, GROUP), sealed, CTX)).toBe(JSON.stringify({ locked: true }));

    const raw = sealed.slice(4);
    const flip = (raw[10] === 'a' ? 'b' : 'a') + raw.slice(1);
    expect(openFor(lockKeyV2(SEED, GROUP), 'sv2.' + flip[0] + flip.slice(1), CTX)).toBeNull();
  });

  it('binds the group id, so another wallet cannot substitute its state', () => {
    const mine = sealFor(lockKeyV2(SEED, GROUP), JSON.stringify({ locked: false }), CTX);
    const otherCtx = { ...CTX, groupId: 'ffffffffffffffffffffffffffffffff' };
    // Same key, wrong group: refused rather than believed.
    expect(openFor(lockKeyV2(SEED, GROUP), mine, otherCtx)).toBeNull();
  });

  it('binds the key id and the purpose inside the MAC', () => {
    const box = sealFor(lockKeyV2(SEED, GROUP), '{"locked":true}', CTX);
    expect(openFor(lockKeyV2(SEED, GROUP), box, { ...CTX, kid: 'v1' })).toBeNull();
    expect(openFor(lockKeyV2(SEED, GROUP), box, { ...CTX, purpose: 'pairing' })).toBeNull();
  });

  it('is authenticated, not just encrypted: a wrong key changes nothing silently', () => {
    const box = sealFor(lockKeyV2(SEED, GROUP), '{"locked":true}', CTX);
    expect(openFor(lockKeyV1(SEED), box, CTX)).toBeNull();
  });

  it('still reads pre-AEAD records so existing state is not lost', () => {
    const legacy = legacySeal(lockKeyV1(SEED), JSON.stringify({ locked: true }));
    expect(openFor(lockKeyV1(SEED), legacy, { ...CTX, kid: 'v1' })).toBeNull();
    expect(open(lockKeyV1(SEED), legacy, { ...CTX, kid: 'v1' })).toBe(JSON.stringify({ locked: true }));
  });

  it('the two-argument API writes the new authenticated format', () => {
    const box = seal(lockKeyV2(SEED, GROUP), 'payload');
    expect(box.startsWith('sv2.')).toBe(true);
    expect(open(lockKeyV2(SEED, GROUP), box)).toBe('payload');
  });

  it('refuses to mint a nonce without a CSPRNG instead of falling back to Math.random', () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const real = g.crypto;
    // Deliberately remove the platform CSPRNG.
    delete g.crypto;
    try {
      expect(() => secureRandomBytes(8)).toThrow(/CSPRNG/);
      expect(() => sealFor(lockKeyV2(SEED, GROUP), 'x', CTX)).toThrow(/CSPRNG/);
    } finally {
      Object.defineProperty(g, 'crypto', { value: real, configurable: true });
    }
  });

  it('produces a fresh nonce per box, so equal payloads differ', () => {
    const a = sealFor(lockKeyV2(SEED, GROUP), 'same', CTX);
    const b = sealFor(lockKeyV2(SEED, GROUP), 'same', CTX);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(nacl.secretbox.overheadLength);
  });
});
