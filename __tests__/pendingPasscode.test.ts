/**
 * Sign-up leaked the same way login did: the passcode hit the keychain before
 * the wallet existed. It is now held in memory and only written when a seed
 * exists.
 */
let mockPersisted: string | null = null;
let mockBio: boolean | null = null;
let mockFailSet = false;

jest.mock('../src/core/storage/passcode', () => ({
  setPasscode: jest.fn(async (c: string) => {
    if (mockFailSet) throw new Error('keystore unavailable');
    mockPersisted = c;
  }),
}));
jest.mock('../src/core/security/biometrics', () => ({
  setBiometricUnlockEnabled: jest.fn(async (v: boolean) => { mockBio = v; }),
}));

import {
  stagePasscode, hasPendingPasscode, clearPendingPasscode, flushPendingPasscode,
} from '../src/core/security/pendingPasscode';

beforeEach(() => {
  mockPersisted = null;
  mockBio = null;
  mockFailSet = false;
  clearPendingPasscode();
});

describe('a passcode chosen during onboarding', () => {
  it('is NOT written while the user is still onboarding', () => {
    stagePasscode('123456', true);
    expect(hasPendingPasscode()).toBe(true);
    expect(mockPersisted).toBeNull();     // nothing registered yet
  });

  it('is written, with the biometric choice, once an account exists', async () => {
    stagePasscode('123456', true);
    await expect(flushPendingPasscode()).resolves.toBe(true);
    expect(mockPersisted).toBe('123456');
    expect(mockBio).toBe(true);
    expect(hasPendingPasscode()).toBe(false);
  });

  it('never flushes twice', async () => {
    stagePasscode('654321', false);
    await flushPendingPasscode();
    mockPersisted = null;
    await expect(flushPendingPasscode()).resolves.toBe(false);
    expect(mockPersisted).toBeNull();
  });

  it('is dropped when the flow is abandoned', async () => {
    stagePasscode('111111', false);
    clearPendingPasscode();
    await expect(flushPendingPasscode()).resolves.toBe(false);
    expect(mockPersisted).toBeNull();
  });

  it('reports failure without leaving a half-written flag', async () => {
    stagePasscode('222222', true);
    mockFailSet = true;
    await expect(flushPendingPasscode()).resolves.toBe(false);
    expect(hasPendingPasscode()).toBe(false);
  });
});
