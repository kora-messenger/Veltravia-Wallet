/**
 * "Can't the unlock on the old device still work?" — yes, and this pins it.
 *
 * Because the wallet group is derived from the recovery phrase (like Trust
 * Wallet), a second device that recovers the same wallet is the SAME identity.
 * So:
 *   • lock on phone A  -> phone B (recovered, no pairing) refuses to move value;
 *   • unlock on phone A -> phone B clears, without any pairing step;
 *   • unlock on phone B -> phone A clears too, because the group is shared.
 */
jest.mock('react-native-config', () => ({
  __esModule: true,
  Config: { LOCK_REGISTRY_ENABLED: 'true' },
  default: { LOCK_REGISTRY_ENABLED: 'true' },
}));

jest.mock('../src/core/storage/secureStorage', () => ({
  __esModule: true,
  readSeed: jest.fn(async () => 'legal winner thank year wave sausage worth useful legal winner thank yellow'),
}));

const mockStore = new Map<string, string>();
const store = mockStore;
jest.mock('react-native-keychain', () => ({
  __esModule: true,
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
    WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly',
  },
  setGenericPassword: jest.fn(async (_u: string, v: string, o: any) => {
    mockStore.set(o?.service, v);
    return true;
  }),
  getGenericPassword: jest.fn(async (o: any) => {
    const v = mockStore.get(o?.service);
    return v === undefined ? false : { username: 'x', password: v, service: o?.service };
  }),
  resetGenericPassword: jest.fn(async (o: any) => {
    mockStore.delete(o?.service);
    return true;
  }),
}));

var mockDevice = 'device-A';
jest.mock('../src/core/security/walletGroup', () => {
  const actual = jest.requireActual('../src/core/security/walletGroup');
  return { ...actual, deviceId: jest.fn(async () => mockDevice) };
});

// A tiny stand-in for the backend: one sealed blob per group.
const server = new Map<string, string>();
const fetchMock = jest.fn((url: string, init?: any) => {
  if (init?.method === 'PUT') {
    const body = JSON.parse(init.body);
    server.set(body.groupId, body.blob);
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  }
  const groupId = decodeURIComponent(String(url).split('groupId=')[1] ?? '');
  const blob = server.get(groupId);
  return Promise.resolve({
    ok: true,
    status: blob ? 200 : 404,
    json: async () => (blob ? { groupId, blob } : {}),
  });
});
(globalThis as any).fetch = fetchMock;

import { ensureGroup, deriveSeedGroup, __resetWalletGroupForTests } from '../src/core/security/walletGroup';
import {
  publishLockState,
  refreshRegistryLock,
  lockedElsewhere,
  __resetLockRegistryForTests,
} from '../src/core/security/lockRegistry';
import { movementBlock } from '../src/core/security/valueGuard';
import { walletLocked, setWalletLocked, refreshWalletLocks } from '../src/core/security/walletLock';

const SEED = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

/** Pretend we are the same wallet restored on a different phone. */
async function becomeDevice(id: string) {
  mockDevice = id;
  // A real second phone has its own (empty) keystore, so no id or lock state
  // carries over — only the recovery phrase does.
  mockStore.clear();
  __resetWalletGroupForTests();
  __resetLockRegistryForTests();
  await refreshWalletLocks(); // this phone has no local lock of its own
}

beforeEach(async () => {
  server.clear();
  fetchMock.mockClear();
  await becomeDevice('device-A');
  await setWalletLocked('default', false);
});

describe('the seed is the identity, like Trust Wallet', () => {
  it('derives the same group id and key from the same phrase on any device', async () => {
    const a = await ensureGroup();
    await becomeDevice('device-B');
    const b = await ensureGroup();
    expect(b.groupId).toBe(a.groupId);
    expect(b.key).toBe(a.key);
  });

  it('gives two different phrases two unrelated groups', () => {
    const one = deriveSeedGroup(SEED);
    const two = deriveSeedGroup('zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong');
    expect(one.groupId).not.toBe(two.groupId);
    expect(one.key).not.toBe(two.key);
  });
});

describe('locking and unlocking across devices', () => {
  it('locks the second device, then clears it when the old device unlocks', async () => {
    // Phone A locks.
    await setWalletLocked('default', true);
    expect(await publishLockState(true)).toBe(true);

    // Phone B: same wallet recovered from the phrase, no pairing at all.
    await becomeDevice('device-B');
    await refreshRegistryLock();
    expect(lockedElsewhere()).toEqual({ deviceName: undefined });
    expect(movementBlock('default')?.kind).toBe('locked-elsewhere');

    // Phone A unlocks. This is the behaviour in question: it DOES still work.
    await becomeDevice('device-A');
    await setWalletLocked('default', false);
    expect(await publishLockState(false)).toBe(true);

    await becomeDevice('device-B');
    await refreshRegistryLock();
    expect(lockedElsewhere()).toBeNull();
    expect(movementBlock('default')).toBeNull();
  });

  it('also clears when the unlock happens on the newer device', async () => {
    await setWalletLocked('default', true);
    await publishLockState(true);

    await becomeDevice('device-B');
    await refreshRegistryLock();
    expect(movementBlock('default')?.kind).toBe('locked-elsewhere');

    // Unlocking on the recovered phone publishes for the whole group.
    await setWalletLocked('default', false);
    await publishLockState(false);
    expect(walletLocked('default')).toBe(false);
    expect(await publishLockState(false)).toBe(true);

    await becomeDevice('device-A');
    await refreshRegistryLock();
    expect(lockedElsewhere()).toBeNull();
  });

  it('survives a backend that is down: a locked answer stays locked', async () => {
    await setWalletLocked('default', true);
    await publishLockState(true);

    await becomeDevice('device-B');
    await refreshRegistryLock();
    expect(movementBlock('default')?.kind).toBe('locked-elsewhere');

    fetchMock.mockReturnValueOnce(Promise.reject(new Error('offline')));
    await refreshRegistryLock();
    expect(movementBlock('default')?.kind).toBe('locked-elsewhere');
  });
});
