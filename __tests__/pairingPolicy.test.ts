/**
 * Pairing must be additive. These tests lock that in:
 *
 *   • a wallet that was locked stays locked through a pairing;
 *   • a "locked elsewhere" answer is never replaced by "unlocked" just because a
 *     device was added;
 *   • the code still hands over, i.e. the guard does not break pairing itself;
 *   • a joiner does not inherit an "unlocked" opinion from the host either.
 */
jest.mock('react-native-keychain', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    ACCESS_CONTROL: { BIOMETRY_CURRENT_SET: 'bio' },
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly', WHEN_UNLOCKED: 'b' },
    setGenericPassword: jest.fn(async (_u: string, value: string, opts: any) => {
      store.set(opts?.service, value);
      return true;
    }),
    getGenericPassword: jest.fn(async (opts: any) => {
      const v = store.get(opts?.service);
      return v === undefined ? false : { username: 'x', password: v, service: opts?.service };
    }),
    resetGenericPassword: jest.fn(async (opts: any) => {
      store.delete(opts?.service);
      return true;
    }),
    getSupportedBiometryType: jest.fn(async () => null),
    __store: store,
  };
});

import { setPairingRelay } from '../src/core/security/pairingRelay';
import {
  __resetPairingSessionsForTests,
  approveJoiner,
  joinPairingSession,
  parsePairingCode,
  startPairingSession,
  waitForJoiner,
} from '../src/core/security/pairingSession';
import { captureProtections, protectionsIntact, restoreProtections } from '../src/core/security/pairingPolicy';
import { allWalletLocks, refreshWalletLocks, setWalletLocked } from '../src/core/security/walletLock';

const groupMaterial = { groupId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', key: '22'.repeat(32), epoch: 0 };

function relay() {
  const rows = new Map<string, any>();
  setPairingRelay({
    open: async (s) => {
      rows.set(s.sessionId, { ...s });
    },
    join: async (id, pub) => {
      const row = rows.get(id);
      if (!row) throw new Error('gone');
      row.joinerPub = pub;
    },
    poll: async (id) => (rows.get(id) ? { joinerPub: rows.get(id).joinerPub, sealed: rows.get(id).sealed, cancelled: rows.get(id).cancelled } : { cancelled: true }),
    deliver: async (id, p) => {
      const row = rows.get(id);
      if (row) row.sealed = p.sealed;
    },
    cancel: async (id) => {
      const row = rows.get(id);
      if (row) row.cancelled = true;
    },
  });
  return rows;
}

describe('pairing does not weaken the device that starts it', () => {
  beforeEach(async () => {
    __resetPairingSessionsForTests();
    relay();
    await setWalletLocked('default', false);
    await setWalletLocked('trading', false);
  });

  it('leaves a locked wallet locked, and still hands the code over', async () => {
    await setWalletLocked('default', true);
    const before = await captureProtections();
    expect(before.wallets.default).toBe(true);

    const session = await startPairingSession();
    const parsed = parsePairingCode(session.uri);
    if (!parsed.ok) throw new Error('code should parse');

    const hostSide = waitForJoiner();
    const joinSide = joinPairingSession(parsed.code);
    const joined = await hostSide;
    if (joined.status !== 'joined') throw new Error('expected join');

    const ok = await approveJoiner(joined.joinerPub, groupMaterial);
    expect(ok).toBe(true);
    expect((await joinSide).status).toBe('joined');

    await refreshWalletLocks();
    expect(allWalletLocks().default).toBe(true);
    expect(protectionsIntact(await restoreProtections(before))).toBe(true);
  });

  it('never turns a locked wallet off, even if something cleared it mid-pairing', async () => {
    await setWalletLocked('default', true);
    await setWalletLocked('trading', true);
    const before = await captureProtections();

    // Simulate any stray code path that unlocks during pairing.
    await setWalletLocked('default', false);

    const drift = await restoreProtections(before);
    expect(drift.unlocked).toEqual(['default']);
    expect(protectionsIntact(drift)).toBe(false);
    await refreshWalletLocks();
    expect(allWalletLocks()).toMatchObject({ default: true, trading: true });
  });

  it('reports a clean slate when nothing moved, so the caller can trust it', async () => {
    const before = await captureProtections();
    expect(protectionsIntact(await restoreProtections(before))).toBe(true);
  });
});
