/**
 * The lock must not cost privacy.
 *
 * Off by default, the app sends NOTHING about a lock: no seed-derived key, no
 * device model, no request at all. The lock stays a local, non-custodial flag,
 * which is what "non-custodial" has to mean in practice — no server holds a key,
 * can sign, can move funds, or can unlock.
 */
jest.mock('react-native-config', () => ({
  __esModule: true,
  Config: { LOCK_REGISTRY_ENABLED: 'false' },
  default: { LOCK_REGISTRY_ENABLED: 'false' },
}));

jest.mock('../src/core/storage/secureStorage', () => ({
  __esModule: true,
  readSeed: jest.fn(async () => 'legal winner thank year wave sausage worth useful legal winner thank yellow'),
}));

const fetchMock = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) }));
(globalThis as any).fetch = fetchMock;

import {
  publishLockState,
  refreshRegistryLock,
  lockedElsewhere,
  __resetLockRegistryForTests,
} from '../src/core/security/lockRegistry';
import { movementBlock } from '../src/core/security/valueGuard';

beforeEach(() => {
  fetchMock.mockClear();
  __resetLockRegistryForTests();
});

describe('registry switched off (the default)', () => {
  it('never contacts the backend, even when locking or unlocking', async () => {
    expect(await publishLockState(true)).toBe(false);
    expect(await publishLockState(false)).toBe(false);
    expect(await refreshRegistryLock()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves no cross-device block behind', () => {
    expect(lockedElsewhere()).toBeNull();
    expect(movementBlock('default')).toBeNull();
  });
});
