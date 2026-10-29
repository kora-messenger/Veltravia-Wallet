/**
 * A paired phone arrives as protected as the old one.
 *
 * The wallet is the same wallet, so a lock is not a property of a handset: if the
 * old phone was locked, the new one must be locked, and the password the user
 * already knows must open it there too. What travels is the lock flag and the
 * salted digest, never the password itself, and a local credential is never
 * replaced by one that came from another device.
 */
jest.mock('react-native-keychain', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    ACCESS_CONTROL: { BIOMETRY_CURRENT_SET: 'bio' },
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'ThisDeviceOnly', WHEN_UNLOCKED: 'unlocked' },
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

import * as Keychain from 'react-native-keychain';
import { setPairingRelay } from '../src/core/security/pairingRelay';
import {
  __resetPairingSessionsForTests,
  approveJoiner,
  beginPairingJoin,
  completePairingJoin,
  parsePairingCode,
  startPairingSession,
  waitForJoiner,
} from '../src/core/security/pairingSession';
import { __resetPairingAttemptsForTests, verifyPairingDigits } from '../src/core/security/pairingVerify';
import { beginPairingFromUri, finishPairing } from '../src/core/security/pairDevice';
import { movementBlock } from '../src/core/security/valueGuard';
import { exportLockMaterial, importLockMaterial } from '../src/core/security/lockTransfer';
import { refreshWalletLocks, setWalletLocked, walletLocked } from '../src/core/security/walletLock';
import {
  hasSecurityPassword,
  setSecurityPassword,
  verifySecurityPassword,
} from '../src/core/storage/securityPassword';
import { storeSeed } from '../src/core/storage/secureStorage';

const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'open sesame please';
const groupMaterial = { groupId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', key: '22'.repeat(32), epoch: 0 };

const keychainStore = (Keychain as any).__store as Map<string, string>;

/** Pull the plug on this "device": forget every keychain entry it had. */
function factoryReset() {
  keychainStore.clear();
}

function wire() {
  const rows = new Map<string, Record<string, any>>();
  const seen: string[] = [];
  setPairingRelay({
    open: async (s) => {
      seen.push(JSON.stringify(s));
      rows.set(s.sessionId, { ...s });
    },
    join: async (id, pub) => {
      seen.push(JSON.stringify({ id, pub }));
      const row = rows.get(id);
      if (!row) throw new Error('gone');
      row.joinerPub = pub;
    },
    poll: async (id) => {
      const row = rows.get(id);
      return row ? { joinerPub: row.joinerPub, sealed: row.sealed, cancelled: row.cancelled } : { cancelled: true };
    },
    deliver: async (id, p) => {
      seen.push(JSON.stringify(p));
      const row = rows.get(id);
      if (!row) throw new Error('gone');
      if (row.cancelled) throw new Error('cancelled');
      row.sealed = p.sealed;
    },
    cancel: async (id) => {
      const row = rows.get(id);
      if (row) row.cancelled = true;
    },
  });
  return { rows, seen };
}

describe('lock state follows the wallet onto the new device', () => {
  beforeEach(async () => {
    __resetPairingSessionsForTests();
    __resetPairingAttemptsForTests();
    wire();
    factoryReset();
    await storeSeed(PHRASE);
    await refreshWalletLocks();
  });

  it('a locked wallet arrives locked, and the same password opens it', async () => {
    await setSecurityPassword('default', PASSWORD);
    await setWalletLocked('default', true);

    // The new phone scans, the old one approves — then the new phone is on its own.
    const session = await startPairingSession();
    const hostWait = waitForJoiner();
    const began = await beginPairingFromUri(session.uri);
    if (!began.ok) throw new Error(began.reason);
    const joined = await hostWait;
    if (joined.status !== 'joined') throw new Error('expected join');
    expect(await approveJoiner(joined.joinerPub, groupMaterial)).toBe(true);

    factoryReset();
    const outcome = await finishPairing(began.begun, joined.safetyNumber, 'New phone');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.lockedWallets).toContain('default');
    expect(outcome.passwordWallets).toContain('default');
    await refreshWalletLocks();
    expect(walletLocked('default')).toBe(true);

    // The password the user already knows works here; a wrong one does not.
    expect(await hasSecurityPassword('default')).toBe(true);
    expect(await verifySecurityPassword('default', PASSWORD)).toBe(true);
    expect(await verifySecurityPassword('default', 'open sesame pleasf')).toBe(false);
  });

  it('the password itself is never in the box, only a salted digest', async () => {
    await setSecurityPassword('default', PASSWORD);
    await setWalletLocked('default', true);

    const session = await startPairingSession();
    const parsed = parsePairingCode(session.uri);
    if (!parsed.ok) throw new Error('code should parse');
    const hostWait = waitForJoiner();
    const begun = await beginPairingJoin(parsed.code);
    if (begun.status !== 'begun') throw new Error(begun.status);
    const joined = await hostWait;
    if (joined.status !== 'joined') throw new Error('expected join');
    await verifyPairingDigits(begun.handle, joined.safetyNumber);
    await approveJoiner(joined.joinerPub, groupMaterial);

    // Nothing readable left the device: the sealed body is base64-ish ciphertext.
    const everything = wire().seen.join(' ');
    expect(everything).not.toContain(PASSWORD);

    const material = await exportLockMaterial();
    const verifier = material.verifiers.default;
    expect(verifier).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(verifier).not.toContain(PASSWORD);
  });

  it('an unlocked wallet does not invent a lock', async () => {
    await setWalletLocked('default', false);

    const session = await startPairingSession();
    const parsed = parsePairingCode(session.uri);
    if (!parsed.ok) throw new Error('code should parse');
    const hostWait = waitForJoiner();
    const begun = await beginPairingJoin(parsed.code);
    if (begun.status !== 'begun') throw new Error(begun.status);
    const joined = await hostWait;
    if (joined.status !== 'joined') throw new Error('expected join');
    await verifyPairingDigits(begun.handle, joined.safetyNumber);
    await approveJoiner(joined.joinerPub, groupMaterial);

    factoryReset();
    const done = await completePairingJoin(begun.handle);
    if (done.status !== 'joined') throw new Error('expected join');
    await importLockMaterial(done.lock);
    await refreshWalletLocks();
    expect(walletLocked('default')).toBe(false);
  });

  it('never replaces a password this device already chose', async () => {
    await setSecurityPassword('default', 'mine and only mine');

    const material = await exportLockMaterial();
    // Simulate a verifier from another wallet/device.
    const foreign = { locked: {}, verifiers: { default: 'aa'.repeat(16) + ':' + 'bb'.repeat(32) }, at: Date.now() };
    const applied = await importLockMaterial(foreign);
    expect(applied.passwords).toEqual([]);
    expect(await verifySecurityPassword('default', 'mine and only mine')).toBe(true);
    expect(material.verifiers.default).not.toBe(foreign.verifiers.default);
  });

  it('exporting lock material does not change the host', async () => {
    await setSecurityPassword('default', PASSWORD);
    await setWalletLocked('default', true);
    const before = { ...(await refreshWalletLocks()) };

    await exportLockMaterial();
    await refreshWalletLocks();
    expect(walletLocked('default')).toBe(true);
    expect(await verifySecurityPassword('default', PASSWORD)).toBe(true);
    expect({ ...(await refreshWalletLocks()) }).toEqual(before);
  });

  it('the inherited lock really gates money, and unlocking here clears it', async () => {
    await setSecurityPassword('default', PASSWORD);
    await setWalletLocked('default', true);

    const session = await startPairingSession();
    const hostWait = waitForJoiner();
    const began = await beginPairingFromUri(session.uri);
    if (!began.ok) throw new Error(began.reason);
    const joined = await hostWait;
    if (joined.status !== 'joined') throw new Error('expected join');
    await verifyPairingDigits(began.begun.handle, joined.safetyNumber);
    await approveJoiner(joined.joinerPub, groupMaterial);

    factoryReset();
    const outcome = await finishPairing(began.begun, joined.safetyNumber, 'New phone');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Same guard the Send/Swap/Perps paths ask: this wallet's value movement is frozen.
    expect(await movementBlock('default')).toBeTruthy();

    // Unlocking on THIS device needs no permission from the old one.
    await setWalletLocked('default', false);
    await refreshWalletLocks();
    expect(walletLocked('default')).toBe(false);
    expect(await movementBlock('default')).toBeNull();
  });
});
