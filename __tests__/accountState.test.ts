/**
 * The bug Ijezie hit (31 Oct 2026): tap "I already have an account", set a
 * passcode, never finish the login -> next cold start locked the app and then
 * opened Home as if an account existed. These tests pin the rule that an
 * account is a stored seed, not a passcode.
 */
let mockSettings: Record<string, any> = {};
let mockPasscode: string | null = null;
let mockSeed: string | null = null;
let mockSeedThrows = false;
let mockAccount: 'yes' | 'no' | 'unknown' = 'no';

jest.mock('../src/core/storage/secureStorage', () => ({
  readSettings: jest.fn(async () => ({ ...mockSettings })),
  writeSettings: jest.fn(async (patch: Record<string, any>) => {
    mockSettings = { ...mockSettings, ...patch };
    return mockSettings;
  }),
  hasWallet: jest.fn(async () => {
    if (mockSeedThrows) throw new Error('prompt cancelled');
    return mockSeed !== null;
  }),
}));

jest.mock('../src/core/storage/passcode', () => ({
  hasPasscode: jest.fn(async () => mockPasscode !== null),
}));

import { resolveAccountState, readAccountMarker } from '../src/core/storage/accountState';

beforeEach(() => {
  mockSettings = {};
  mockPasscode = null;
  mockSeed = null;
  mockSeedThrows = false;
});

describe('resolveAccountState', () => {
  it('a fresh device is "no" and records it without touching the seed', async () => {
    await expect(resolveAccountState()).resolves.toBe('no');
    await expect(readAccountMarker()).resolves.toBe('no');
  });

  it('passcode + stored seed is an account: "yes"', async () => {
    mockPasscode = 'salt:digest';
    mockSeed = 'twelve words';
    await expect(resolveAccountState()).resolves.toBe('yes');
    await expect(readAccountMarker()).resolves.toBe('yes');
  });

  it('passcode with NO seed is an abandoned login: "no"', async () => {
    mockPasscode = 'salt:digest';
    await expect(resolveAccountState()).resolves.toBe('no');
  });

  it('a cancelled keychain prompt is "unknown", and nothing is recorded', async () => {
    mockPasscode = 'salt:digest';
    mockSeedThrows = true;
    await expect(resolveAccountState()).resolves.toBe('unknown');
    await expect(readAccountMarker()).resolves.toBeNull();
  });

  it('once the marker exists it is trusted (no passcode or seed read)', async () => {
    mockSettings = { accountState: 'yes' };
    mockSeedThrows = true; // would blow up if read
    await expect(resolveAccountState()).resolves.toBe('yes');
  });
});

/* ---- the boot gate the app actually uses ------------------------------- */

describe('resolveAccountGate (what Navigation boots with)', () => {
  const cleared: string[] = [];
  const bio: boolean[] = [];

  beforeEach(() => {
    cleared.length = 0;
    bio.length = 0;
    jest.resetModules();
  });

  const load = () => {
    jest.doMock('../src/core/storage/accountState', () => ({
      resolveAccountState: async () => mockAccount,
    }));
    jest.doMock('../src/core/storage/passcode', () => ({
      hasPasscode: async () => mockPasscode !== null,
      clearPasscode: async () => { cleared.push('passcode'); mockPasscode = null; },
    }));
    jest.doMock('../src/core/security/biometrics', () => ({
      setBiometricUnlockEnabled: async (v: boolean) => { bio.push(v); },
    }));
    return require('../src/core/security/accountGate').resolveAccountGate();
  };

  it('no account + leftover passcode: welcome screen, no lock, passcode dropped', async () => {
    mockAccount = 'no';
    mockPasscode = 'salt:digest';
    const gate = await load();
    expect(gate).toEqual({ hasAccount: false, lock: false, clearedOrphanPasscode: true });
    expect(cleared).toEqual(['passcode']);
    expect(bio).toEqual([false]);
  });

  it('a real account + passcode locks the app and opens Home after unlock', async () => {
    mockAccount = 'yes';
    mockPasscode = 'salt:digest';
    const gate = await load();
    expect(gate).toEqual({ hasAccount: true, lock: true, clearedOrphanPasscode: false });
    expect(cleared).toEqual([]);
  });

  it('a real account with no passcode opens unlocked', async () => {
    mockAccount = 'yes';
    mockPasscode = null;
    const gate = await load();
    expect(gate).toEqual({ hasAccount: true, lock: false, clearedOrphanPasscode: false });
  });

  it('unknown (keychain unreadable) never destroys the passcode', async () => {
    mockAccount = 'unknown';
    mockPasscode = 'salt:digest';
    const gate = await load();
    expect(gate.lock).toBe(true);
    expect(cleared).toEqual([]);
  });
});
