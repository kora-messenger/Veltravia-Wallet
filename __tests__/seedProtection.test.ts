/**
 * Creating a wallet used to fail outright when the phone had no enrolled
 * biometrics: the seed's Keystore key asked for BIOMETRY_CURRENT_SET, Android
 * refused to generate it, and the user got "Couldn't finish setting up your
 * wallet" with no path forward (Ijezie, 6 Nov 2026). The ladder in storeSeed
 * falls back to the screen lock, then to the app's own lock, and records which
 * level it used so the UI can be honest about it.
 */
const store: Record<string, string> = {};
let mockRefuse: Set<string>;

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlocked' },
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET: 'bio',
    BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'bioOrLock',
  },
  setGenericPassword: jest.fn(async (user: string, pass: string, o: any) => {
    if (mockRefuse.has(o.accessControl ?? '')) {
      const e: any = new Error(`Could not generate key: ${o.accessControl} unavailable`);
      throw e;
    }
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

import { storeSeed, readSeed, readSettings, seedProtection } from '../src/core/storage/secureStorage';

const reset = () => {
  for (const k of Object.keys(store)) delete store[k];
  mockRefuse = new Set();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
};

beforeEach(reset);
afterEach(() => jest.restoreAllMocks());

describe('seed protection', () => {
  it('binds to the enrolled biometrics when the phone has them', async () => {
    await storeSeed('twelve words');
    await expect(seedProtection()).resolves.toBe('biometric');
    await expect(readSeed()).resolves.toBe('twelve words');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('falls back to the screen lock when no biometric is enrolled', async () => {
    mockRefuse.add('bio');
    await storeSeed('twelve words');
    await expect(seedProtection()).resolves.toBe('device-lock');
    await expect(readSeed()).resolves.toBe('twelve words');
    await expect(readSettings()).resolves.toMatchObject({ accountState: 'yes' });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('device-lock'));
  });

  it('still creates the wallet on a phone with neither, and says so', async () => {
    mockRefuse.add('bio');
    mockRefuse.add('bioOrLock');
    await storeSeed('twelve words');
    await expect(seedProtection()).resolves.toBe('app-lock');
    await expect(readSeed()).resolves.toBe('twelve words');
    // The account is real, and the wallet lock is now the only gate.
    await expect(readSettings()).resolves.toMatchObject({ accountState: 'yes', seedProtection: 'app-lock' });
  });

  it('reports every failed level when storage is unusable', async () => {
    mockRefuse.add('bio');
    mockRefuse.add('bioOrLock');
    mockRefuse.add(''); // and the unprotected write
    await expect(storeSeed('twelve words')).rejects.toThrow(/biometric: .*device-lock: .*app-lock:/s);
    // Nothing half-written: onboarding must not think an account exists.
    await expect(readSettings()).resolves.not.toMatchObject({ accountState: 'yes' });
    await expect(readSeed()).resolves.toBeNull();
  });
});
