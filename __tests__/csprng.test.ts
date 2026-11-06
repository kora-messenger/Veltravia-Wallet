/**
 * A release build had no random source at all: Hermes has no
 * `crypto.getRandomValues`, so wallet creation died at "no CSPRNG available:
 * refusing to generate a nonce" (Ijezie, 6 Nov 2026). The refusal was correct;
 * what was missing was entropy. These pin the native source, the Web-API shim,
 * and that the refusal still happens when neither exists.
 */
import { NativeModules } from 'react-native';

import {
  base64ToBytes,
  clearCsprngPool,
  csprngAvailable,
  installCsprng,
  nativeRandomBytes,
  primeCsprngPool,
} from '../src/core/crypto/csprng';
import { secureRandomBytes } from '../src/core/crypto/hash';

const mod: any = NativeModules;
const setModule = (m: any) => {
  mod.RandomModule = m;
};

let savedCrypto: any;
beforeEach(() => {
  // Node 18+ exposes webcrypto; this file is about the engine WITHOUT it.
  savedCrypto = (globalThis as any).crypto;
  delete (globalThis as any).crypto;
  clearCsprngPool();
  setModule(undefined);
});
afterEach(() => {
  if (savedCrypto !== undefined) (globalThis as any).crypto = savedCrypto;
  setModule(undefined);
});

describe('the native CSPRNG bridge', () => {
  it('decodes what the platform returns', () => {
    // AQIDBA== is 01 02 03 04
    setModule({ getRandomBase64: (n: number) => 'AQIDBA==' });
    expect(Array.from(nativeRandomBytes(4)!)).toEqual([1, 2, 3, 4]);
  });

  it('rejects a short or malformed answer instead of padding it', () => {
    setModule({ getRandomBase64: () => 'AQID' }); // 3 bytes, asked for 4
    expect(nativeRandomBytes(4)).toBeNull();
    setModule({ getRandomBase64: () => { throw new Error('boom'); } });
    expect(nativeRandomBytes(4)).toBeNull();
  });

  it('reports no CSPRNG when the module is missing', () => {
    expect(nativeRandomBytes(16)).toBeNull();
    expect(csprngAvailable()).toBe(false);
  });

  it('still refuses to mint a nonce with no source at all', () => {
    expect(() => secureRandomBytes(12)).toThrow(/no CSPRNG available/);
  });

  it('mints a nonce from the platform when the shim is not installed', () => {
    let call = 0;
    setModule({ getRandomBase64: (n: number) => (call++ === 0 ? 'AQIDBAUGBwgJCgsM' : 'AQIDBAUGBwgJCgsM') });
    const out = secureRandomBytes(12);
    expect(out.length).toBe(12);
    expect(Array.from(out).slice(0, 4)).toEqual([1, 2, 3, 4]);
  });
});

describe('entropy pool (bridgeless hosts that refuse sync calls)', () => {
  const refuseSync = (bytesB64: string) => ({
    getRandomBase64: () => {
      throw new Error('synchronous methods not supported');
    },
    getRandomBase64Async: async () => bytesB64,
  });

  it('primes from the async call and serves bytes when the sync call fails', async () => {
    setModule(refuseSync('AQIDBAUGBwgJCgsM')); // 12 bytes
    await expect(primeCsprngPool(12)).resolves.toBe(true);
    expect(csprngAvailable()).toBe(true);
    expect(Array.from(nativeRandomBytes(4)!)).toEqual([1, 2, 3, 4]);
  });

  it('does not hand out bytes it does not have', async () => {
    setModule(refuseSync('AQIDBA==')); // 4 bytes
    await primeCsprngPool(4);
    expect(nativeRandomBytes(8)).toBeNull(); // asked for more than the pool holds
  });

  it('still refuses a nonce when the sync call fails and nothing was primed', () => {
    setModule({
      getRandomBase64: () => {
        throw new Error('no sync');
      },
    });
    expect(() => secureRandomBytes(12)).toThrow(/no CSPRNG available/);
  });
});

describe('the crypto shim', () => {
  it('installs getRandomValues and fills the caller view in place', () => {
    setModule({ getRandomBase64: () => 'AQIDBAUGBwg=' }); // 01..08
    expect(installCsprng()).toBe(true);
    const g: any = globalThis as any;
    expect(typeof g.crypto.getRandomValues).toBe('function');

    const u32 = new Uint32Array(2); // byteLength 8
    const same = g.crypto.getRandomValues(u32);
    expect(same).toBe(u32);
    expect(Array.from(new Uint32Array(u32.buffer))).toEqual([0x04030201, 0x08070605]);
    expect(csprngAvailable()).toBe(true);
  });

  it('leaves an engine that already has one alone', () => {
    const existing = jest.fn(() => undefined);
    (globalThis as any).crypto = { getRandomValues: existing };
    setModule({ getRandomBase64: () => 'AQIDBA==' });
    expect(installCsprng()).toBe(true);
    expect((globalThis as any).crypto.getRandomValues).toBe(existing);
  });

  it('reports false when it cannot install anything', () => {
    expect(installCsprng()).toBe(false);
  });
});

describe('base64ToBytes', () => {
  it('handles padding and ignores stray characters', () => {
    expect(Array.from(base64ToBytes('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(base64ToBytes('AQ=='))).toEqual([1]);
    expect(Array.from(base64ToBytes('AQID\n'))).toEqual([1, 2, 3]);
  });
});
