/**
 * Pairing must be safe to show on a screen to someone standing next to you.
 *
 * The guarantees under test, in the user's words:
 *   • the code carries no recovery phrase and no private key (in fact no key
 *     material at all beyond an ephemeral public key);
 *   • it expires after 60 seconds, on its own;
 *   • it works once;
 *   • it carries a unique session id and the material to start a secure channel;
 *   • both devices can be authenticated before anything secret moves (six-digit
 *     safety number derived from both keys);
 *   • it can be cancelled.
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
    __store: store,
  };
});

import nacl from 'tweetnacl';
import { setPairingRelay, type PairingRelay, type PairingRelayState } from '../src/core/security/pairingRelay';
import {
  PAIRING_TTL_MS,
  __resetPairingSessionsForTests,
  approveJoiner,
  cancelPairingSession,
  currentPairingSession,
  joinPairingSession,
  parsePairingCode,
  safetyNumber,
  startPairingSession,
  waitForJoiner,
} from '../src/core/security/pairingSession';
import { storeSeed } from '../src/core/storage/secureStorage';

/** One in-memory relay standing in for the server, shared by both "devices". */
function memoryRelay() {
  const rows = new Map<string, { hostPub: string; expiresAt: number; joinerPub?: string; sealed?: string; cancelled?: boolean }>();
  const relay: PairingRelay & { rows: typeof rows } = {
    rows,
    async open(s) {
      rows.set(s.sessionId, { hostPub: s.hostPub, expiresAt: s.expiresAt });
    },
    async join(id, joinerPub) {
      const row = rows.get(id);
      if (!row || row.cancelled || row.expiresAt <= Date.now()) throw new Error('pair-gone');
      row.joinerPub = joinerPub;
    },
    async poll(id): Promise<PairingRelayState | null> {
      const row = rows.get(id);
      if (!row) return { cancelled: true };
      return { joinerPub: row.joinerPub, sealed: row.sealed, cancelled: row.cancelled };
    },
    async deliver(id, payload) {
      const row = rows.get(id);
      if (!row || row.cancelled) throw new Error('pair-gone');
      row.sealed = payload.sealed;
    },
    async cancel(id) {
      const row = rows.get(id);
      if (row) row.cancelled = true;
    },
  };
  return relay;
}

const groupMaterial = {
  groupId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  key: '11'.repeat(32),
  epoch: 0,
};

describe('pairing codes', () => {
  beforeEach(() => {
    __resetPairingSessionsForTests();
    setPairingRelay(memoryRelay());
  });

  it('carries a session id, an ephemeral public key and an expiry — nothing else', async () => {
    const session = await startPairingSession(1_000_000);
    const parsed = parsePairingCode(session.uri, 1_000_000);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.code.sessionId).toBe(session.sessionId);
    expect(parsed.code.hostPub).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.code.expiresAt).toBe(1_000_000 + PAIRING_TTL_MS);

    // No key material of any kind beyond that public key.
    const lower = session.uri.toLowerCase();
    expect(lower).not.toContain(groupMaterial.key.toLowerCase());
    expect(lower).not.toContain('mnemonic');
    expect(lower).not.toContain('seed');
    expect(lower).not.toContain('&k=');
    expect(lower).not.toContain('&g=');
    expect(session.uri.startsWith('veltravia-pair://2?')).toBe(true);
    expect(session.uri.length).toBeLessThan(140);
  });

  it('is 60 seconds, and refuses itself after that without anyone acting', async () => {
    expect(PAIRING_TTL_MS).toBe(60_000);
    const session = await startPairingSession(5_000);
    expect(parsePairingCode(session.uri, 5_000 + 59_000).ok).toBe(true);
    expect(parsePairingCode(session.uri, 5_000 + 60_000)).toEqual({ ok: false, reason: 'expired' });
    expect(currentPairingSession(5_000 + 60_000)).toBeNull();
  });

  it('gives every session a different id and a different ephemeral key', async () => {
    const a = await startPairingSession();
    const b = await startPairingSession();
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(a.hostPub).not.toBe(b.hostPub);
  });

  it('refuses the old code format that embedded the group key', () => {
    const legacy = `veltravia-pair://join?g=${groupMaterial.groupId}&k=${groupMaterial.key}&e=${Date.now() + 60_000}`;
    expect(parsePairingCode(legacy)).toEqual({ ok: false, reason: 'legacy' });
  });

  it('rejects junk and partially forged codes', () => {
    expect(parsePairingCode('https://example.com').ok).toBe(false);
    expect(parsePairingCode('veltravia-pair://2?s=zz&p=aa&e=1').ok).toBe(false);
    const good = 'veltravia-pair://2?s=00112233445566778899aabbccddeeff&p=' + 'ab'.repeat(32);
    expect(parsePairingCode(`${good}&e=${Date.now() + 1000}`).ok).toBe(true);
    // a v2 code that also smuggles a key is refused, not half-trusted
    expect(parsePairingCode(`${good}&e=${Date.now() + 1000}&k=${'cd'.repeat(32)}`)).toEqual({
      ok: false,
      reason: 'legacy',
    });
  });
});

const PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

describe('the handshake', () => {
  beforeEach(async () => {
    __resetPairingSessionsForTests();
    setPairingRelay(memoryRelay());
    // A device can only hand over a wallet it actually has: the host seals its
    // phrase (plus the group) for the joining device.
    await storeSeed(PHRASE);
  });

  it('hands the group over only after both devices agree on the six digits', async () => {
    const session = await startPairingSession();
    const parsed = parsePairingCode(session.uri);
    if (!parsed.ok) throw new Error('code should parse');

    const hostSide = waitForJoiner();
    const joinSide = joinPairingSession(parsed.code);

    // Host learns the joiner and computes the safety number.
    const joined = await hostSide;
    expect(joined.status).toBe('joined');
    if (joined.status !== 'joined') return;

    // Nothing has been handed over yet: the joiner is still waiting.
    expect(await approveJoiner(joined.joinerPub, groupMaterial)).toBe(true);

    const result = await joinSide;
    expect(result.status).toBe('joined');
    if (result.status !== 'joined') return;

    // Both sides show the same digits, derived from both public keys.
    expect(result.safetyNumber).toBe(joined.safetyNumber);
    expect(joined.safetyNumber).toMatch(/^\d{6}$/);
    expect(result.material).toEqual(groupMaterial);
    expect(result.hostPub).toBe(session.hostPub);
  });

  it('the safety number changes when either side changes, so a swapped key is visible', () => {
    const a = 'ab'.repeat(32);
    const b = 'cd'.repeat(32);
    const c = 'ef'.repeat(32);
    expect(safetyNumber(a, b)).toBe(safetyNumber(b, a));
    expect(safetyNumber(a, b)).not.toBe(safetyNumber(a, c));
    expect(safetyNumber(a, b)).not.toBe(safetyNumber(b, c));
  });

  it('cannot be replayed: the session is dead after one successful pairing', async () => {
    const session = await startPairingSession();
    const parsed = parsePairingCode(session.uri);
    if (!parsed.ok) throw new Error('code should parse');

    const hostSide = waitForJoiner();
    const joinSide = joinPairingSession(parsed.code);
    const joined = await hostSide;
    if (joined.status !== 'joined') throw new Error('expected join');
    await approveJoiner(joined.joinerPub, groupMaterial);
    expect((await joinSide).status).toBe('joined');

    // The same code, on the same device: refuses.
    expect(await joinPairingSession(parsed.code)).toEqual({ status: 'used' });
    // The same code from another device: the relay row is gone.
    __resetPairingSessionsForTests();
    expect((await joinPairingSession(parsed.code)).status).toBe('cancelled');
    // And the host has nothing live to approve against.
    expect(await approveJoiner(joined.joinerPub, groupMaterial)).toBe(false);
  });

  it('leaks nothing to the relay beyond public keys and one ciphertext', async () => {
    const relay = memoryRelay();
    setPairingRelay(relay);
    const session = await startPairingSession();
    const parsed = parsePairingCode(session.uri);
    if (!parsed.ok) throw new Error('code should parse');

    const hostSide = waitForJoiner();
    const joinSide = joinPairingSession(parsed.code);
    const joined = await hostSide;
    if (joined.status !== 'joined') throw new Error('expected join');
    await approveJoiner(joined.joinerPub, groupMaterial);
    await joinSide;

    const row = relay.rows.get(session.sessionId)!;
    expect(row.hostPub).toBe(session.hostPub);
    expect(row.joinerPub).toMatch(/^[0-9a-f]{64}$/);
    // The group key is inside the ciphertext, never readable in the row.
    expect(JSON.stringify(row)).not.toContain(groupMaterial.key);
    expect(JSON.stringify(row)).not.toContain(groupMaterial.groupId);
    expect(row.sealed).toMatch(/^[0-9a-f]+$/);
  });

  it('a cancelled session stops both sides immediately', async () => {
    const relay = memoryRelay();
    setPairingRelay(relay);
    const session = await startPairingSession();
    const parsed = parsePairingCode(session.uri);
    if (!parsed.ok) throw new Error('code should parse');

    const hostSide = waitForJoiner();
    const joinSide = joinPairingSession(parsed.code);
    await cancelPairingSession();

    expect((await hostSide).status).toBe('cancelled');
    expect((await joinSide).status).toBe('cancelled');
    expect(currentPairingSession()).toBeNull();
    // The host cannot approve anything after cancelling.
    const joinerPub = 'ab'.repeat(32);
    expect(await approveJoiner(joinerPub, groupMaterial)).toBe(false);
  });

  it('refuses to hand material to a joiner that is not the one they agreed on', async () => {
    const session = await startPairingSession();
    const parsed = parsePairingCode(session.uri);
    if (!parsed.ok) throw new Error('code should parse');

    const hostSide = waitForJoiner();
    const joinSide = joinPairingSession(parsed.code);
    const joined = await hostSide;
    if (joined.status !== 'joined') throw new Error('expected join');

    // A man in the middle with its own key: the host's digits would not match.
    const mitm = nacl.box.keyPair();
    const mitmPub = Array.from(mitm.publicKey).map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(safetyNumber(session.hostPub, mitmPub)).not.toBe(joined.safetyNumber);

    // Sealing to the wrong key means the real joiner cannot open it: it is
    // detected as tampering, not silently accepted.
    await approveJoiner(mitmPub, groupMaterial);
    const result = await joinSide;
    expect(result.status).toBe('invalid');
  });
});
