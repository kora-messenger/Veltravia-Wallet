/**
 * The shipped failure (Ijezie, 6 Nov 2026): Hermes has no
 * `crypto.getRandomValues`, so a release build had no entropy at all and
 * "Create a wallet" stopped dead with "no CSPRNG available: refusing to
 * generate a nonce".
 *
 * This is the end-to-end version of that path: no Web Crypto anywhere, only the
 * platform's SecureRandom over the native module, and the wallet still gets a
 * real 12-word phrase and lands in storage.
 */
const store: Record<string, string> = {};

jest.mock('react-native', () => ({ NativeModules: {} }));
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlocked' },
  ACCESS_CONTROL: { BIOMETRY_CURRENT_SET: 'bio', BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'bioOrLock' },
  setGenericPassword: jest.fn(async (user: string, pass: string, o: any) => {
    store[o.service] = pass;
    return { service: o.service, storage: 'mock' };
  }),
  getGenericPassword: jest.fn(async (o: any) =>
    store[o.service] !== undefined
      ? { username: 'x', password: store[o.service], service: o.service }
      : false),
  resetGenericPassword: jest.fn(async (o: any) => {
    delete store[o.service];
    return true;
  }),
}));
jest.mock('../src/core/security/pendingPasscode', () => ({
  flushPendingPasscode: jest.fn(async () => true),
  stagePasscode: jest.fn(),
  hasPendingPasscode: jest.fn(() => false),
  clearPendingPasscode: jest.fn(),
}));

import { NativeModules } from 'react-native';
import { clearCsprngPool, installCsprng } from '../src/core/crypto/csprng';
import { walletManager } from '../src/core/wallet/walletManager';
import { readSeed } from '../src/core/storage/secureStorage';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const toBase64 = (bytes: number[]): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
};

const savedCrypto = (globalThis as any).crypto;

beforeAll(() => {
  // The engine as shipped: no Web Crypto, only the Android module.
  delete (globalThis as any).crypto;
  let counter = 0;
  (NativeModules as any).RandomModule = {
    getRandomBase64: (n: number) => {
      // Deterministic but varying bytes: enough to exercise the real path.
      const bytes: number[] = [];
      for (let i = 0; i < n; i++) bytes.push((counter++ * 31 + 7) & 0xff);
      return toBase64(bytes);
    },
  };
  clearCsprngPool();
  installCsprng();
});

afterAll(() => {
  if (savedCrypto !== undefined) (globalThis as any).crypto = savedCrypto;
});

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe('creating a wallet with no Web Crypto', () => {
  it('mints a valid 12-word phrase', () => {
    const phrase = walletManager.generatePhrase(128);
    expect(phrase.split(' ')).toHaveLength(12);
    expect(walletManager.generatePhrase(128)).not.toBe(phrase); // not a constant
  });

  it('creates and stores the wallet without throwing', async () => {
    await expect(walletManager.createWallet()).resolves.toBeUndefined();
    const seed = await readSeed();
    expect(seed?.split(' ')).toHaveLength(12);
  });
});
