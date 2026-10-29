/**
 * Full-access pairing, end to end through the real protocol code:
 *
 *   QR → join → six typed digits → sealed handover → phrase in the keystore.
 *
 * The properties under test are the ones that matter for a non-custodial wallet:
 * the phrase reaches the new device ONLY after the digits match, never appears in
 * anything the relay carries, dies with the session, and a wrong guess burns
 * attempts until the session is dead.
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

// Spy on the two storage calls that matter, keeping the real implementations so
// the bytes still land in the mocked keystore.
jest.mock('../src/core/storage/secureStorage', () => {
  const actual = jest.requireActual('../src/core/storage/secureStorage');
  return { ...actual, storeSeed: jest.fn(actual.storeSeed), wipeWallet: jest.fn(actual.wipeWallet) };
});

import * as Keychain from 'react-native-keychain';
import * as SecureStorage from '../src/core/storage/secureStorage';
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
import { readSeed, storeSeed } from '../src/core/storage/secureStorage';

const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

/** In-memory relay: records every byte that crosses it, like a hostile server would. */
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
      seen.push(JSON.stringify({ cancel: id }));
      const row = rows.get(id);
      if (row) row.cancelled = true;
    },
  });
  return { rows, seen };
}

const groupMaterial = { groupId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', key: '22'.repeat(32), epoch: 0 };

async function pairOnce(typed: (hostDigits: string) => string) {
  const session = await startPairingSession();
  const parsed = parsePairingCode(session.uri);
  if (!parsed.ok) throw new Error('code should parse');

  const hostWait = waitForJoiner();
  const begun = await beginPairingJoin(parsed.code);
  if (begun.status !== 'begun') throw new Error(begun.status);

  const joined = await hostWait;
  if (joined.status !== 'joined') throw new Error('expected join');

  const typing = typed(joined.safetyNumber);
  const verified = await verifyPairingDigits(begun.handle, typing);
  const approved = await approveJoiner(joined.joinerPub, groupMaterial);
  const completed = await completePairingJoin(begun.handle);
  return { verified, approved, completed, hostDigits: joined.safetyNumber, handle: begun.handle };
}

describe('a paired device gets the whole wallet, not just a group', () => {
  beforeEach(async () => {
    __resetPairingSessionsForTests();
    __resetPairingAttemptsForTests();
    wire();
    await storeSeed(PHRASE);
  });

  it('hands the phrase over only after the six digits match', async () => {
    const { verified, completed } = await pairOnce((digits) => digits);
    expect(verified.ok).toBe(true);
    expect(completed.status).toBe('joined');
    if (completed.status !== 'joined') throw new Error('unreachable');
    expect(completed.seed).toBe(PHRASE);
  });

  it('never puts the phrase on the wire, only ciphertext', async () => {
    const { seen } = wire();
    const { completed } = await pairOnce((digits) => digits);
    expect(completed.status).toBe('joined');
    const everything = seen.join(' ');
    expect(everything).not.toContain(PHRASE);
    expect(everything).not.toContain('legal');
    expect(everything).not.toContain('sausage');
    // The sealed blob IS on the wire, and it is opaque.
    expect(everything).toContain('sealed');
  });

  it('a wrong code cannot open the box at all', async () => {
    const { verified, completed } = await pairOnce((digits) =>
      digits === '000000' ? '111111' : '000000',
    );
    expect(verified.ok).toBe(false);
    // Completion refuses a session whose digits were never proven.
    expect(completed).toEqual({ status: 'unverified' });
  });

  it('five wrong guesses kill the session', async () => {
    const session = await startPairingSession();
    const parsed = parsePairingCode(session.uri);
    if (!parsed.ok) throw new Error('code should parse');
    const hostWait = waitForJoiner();
    const begun = await beginPairingJoin(parsed.code);
    if (begun.status !== 'begun') throw new Error(begun.status);
    const joined = await hostWait;
    if (joined.status !== 'joined') throw new Error('expected join');

    const wrong = joined.safetyNumber === '000000' ? '111111' : '000000';
    for (let i = 1; i <= 5; i++) {
      const res = await verifyPairingDigits(begun.handle, wrong);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      if (i < 5) {
        expect(res.reason).toBe('mismatch');
        if (res.reason === 'mismatch') expect(res.attemptsLeft).toBe(5 - i);
      } else {
        expect(res.reason).toBe('exhausted');
      }
    }
    // A correct code can no longer rescue a burned session.
    const after = await verifyPairingDigits(begun.handle, joined.safetyNumber);
    expect(after).toEqual({ ok: false, reason: 'exhausted' });
  });

  it('rejects a five-digit entry without spending an attempt', async () => {
    const session = await startPairingSession();
    const parsed = parsePairingCode(session.uri);
    if (!parsed.ok) throw new Error('code should parse');
    const hostWait = waitForJoiner();
    const begun = await beginPairingJoin(parsed.code);
    if (begun.status !== 'begun') throw new Error(begun.status);
    await hostWait;
    const res = await verifyPairingDigits(begun.handle, '12345');
    expect(res).toEqual({ ok: false, reason: 'format' });
    const real = await verifyPairingDigits(begun.handle, begun.handle.safetyNumber);
    expect(real.ok).toBe(true);
  });
});

describe('the joining screen path stores the phrase where every import puts it', () => {
  beforeEach(async () => {
    __resetPairingSessionsForTests();
    __resetPairingAttemptsForTests();
    wire();
    await storeSeed(PHRASE);
    (SecureStorage.storeSeed as jest.Mock).mockClear();
    (SecureStorage.wipeWallet as jest.Mock).mockClear();
  });

  it('begin → finish writes the phrase through the normal import path', async () => {
    const session = await startPairingSession();
    const hostWait = waitForJoiner();
    const began = await beginPairingFromUri(session.uri);
    if (!began.ok) throw new Error(began.reason);

    const joined = await hostWait;
    if (joined.status !== 'joined') throw new Error('expected join');
    await approveJoiner(joined.joinerPub, groupMaterial);

    const outcome = await finishPairing(began.begun, joined.safetyNumber, 'New phone');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.seeded).toBe(true);
    expect(SecureStorage.storeSeed).toHaveBeenCalledWith(PHRASE);
    // No native derivation bridge in this build, so identity is honestly unknown.
    expect(outcome.identity).toBe('unavailable');
  });

  it('a mismatched code never reaches the storage layer', async () => {
    const session = await startPairingSession();
    const hostWait = waitForJoiner();
    const began = await beginPairingFromUri(session.uri);
    if (!began.ok) throw new Error(began.reason);
    const joined = await hostWait;
    if (joined.status !== 'joined') throw new Error('expected join');

    const outcome = await finishPairing(began.begun, '000000', 'New phone');
    expect(outcome.ok).toBe(false);
    expect(SecureStorage.storeSeed).not.toHaveBeenCalled();
  });

  it('wipes what it just stored when the derived addresses disagree', async () => {
    // Pretend this build CAN derive, and that it derives a different wallet.
    const derive = jest.fn(async () => [{ chainId: '1', address: '0xDIFFERENT' }]);
    (globalThis as any).__WalletCore = {
      HDWalletCreateMnemonic: () => PHRASE,
      HDWalletMnemonicIsValid: () => true,
      StoredKeyImportPhrase: () => 'stored',
      StoredKeyExportPhrase: () => PHRASE,
      StoredKeyAccount: () => 1,
      HDWalletGetAddressForCoin: () => '0xDIFFERENT',
      HDWalletGetAddressDerivation: () => '0xDIFFERENT',
    };
    const walletManager = jest.requireActual('../src/core/wallet/walletManager').walletManager;
    const spy = jest.spyOn(walletManager, 'deriveAccounts');

    const session = await startPairingSession();
    const hostWait = waitForJoiner();
    // Host derives 0xHOST for chain 1.
    spy.mockResolvedValueOnce([{ chainId: '1', address: '0xHOST' }]);
    const began = await beginPairingFromUri(session.uri);
    if (!began.ok) throw new Error(began.reason);
    const joined = await hostWait;
    if (joined.status !== 'joined') throw new Error('expected join');
    await approveJoiner(joined.joinerPub, groupMaterial);

    spy.mockResolvedValueOnce([{ chainId: '1', address: '0xDIFFERENT' }]);
    const outcome = await finishPairing(began.begun, joined.safetyNumber, 'New phone');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe('identity');
    expect(SecureStorage.wipeWallet).toHaveBeenCalled();

    spy.mockRestore();
    delete (globalThis as any).__WalletCore;
    expect(derive).toBeDefined();
  });
});
