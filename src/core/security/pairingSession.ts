/**
 * Veltravia Wallet — pairing sessions.
 *
 * A pairing code is a short-lived, single-use introduction between two devices.
 * It carries NO group key, NO recovery phrase and NO private key — only what is
 * needed to start a handshake:
 *
 *   veltravia-pair://2?s=<sessionId>&p=<host ephemeral public key>&e=<expiry>
 *
 * Flow:
 *   1. Host starts a session: fresh ephemeral X25519 keypair, random session id,
 *      60 second expiry. Only the public half goes into the QR.
 *   2. Joiner scans the code, generates its OWN ephemeral keypair and publishes
 *      only its public half against the session id.
 *   3. Both devices derive the same 6-digit safety number from the two public
 *      keys. The host shows it, the joiner shows it, and the host must confirm
 *      they match BEFORE anything secret moves. That is what authenticates both
 *      devices — a relay that swapped a key cannot produce matching digits.
 *   4. Host seals the group material (group id, current key, epoch) to the
 *      joiner's ephemeral public key and the session is consumed.
 *   5. Joiner opens it with the shared secret, which only those two ephemeral
 *      keys can produce.
 *
 * The session expires on its own after 60 seconds, can be cancelled by either
 * side, and cannot be replayed: the host consumes the id on success and the
 * joiner refuses a code it has already used.
 *
 * Transport: a small relay abstraction (see pairingRelay) so the protocol is
 * testable and the backend can implement four endpoints. Nothing here puts
 * secrets on the wire in the clear — the relay only ever sees public keys, a
 * session id and one ciphertext.
 */
import nacl from 'tweetnacl';
import * as Keychain from 'react-native-keychain';
import { digest } from '../storage/passcode';
import { fromHex, randomBytes, toHex } from '../crypto/hash';
import { wrapFor, unwrapWith } from './walletGroup';
import { pairingRelay, type PairingRelayState } from './pairingRelay';
import { captureProtections, restoreProtections } from './pairingPolicy';

export const PAIR_V2_SCHEME = 'veltravia-pair://2';
/** Short by design: long enough to scan, short enough to be useless if leaked. */
export const PAIRING_TTL_MS = 60_000;
const SESSION_SERVICE = 'com.veltravia.wallet.pairsession';
const POLL_MS = 1_200;

export interface PairingCode {
  sessionId: string;
  /** Host's EPHEMERAL public key. Useless once the session is gone. */
  hostPub: string;
  expiresAt: number;
}

export type CodeRejection = 'scheme' | 'version' | 'malformed' | 'expired' | 'legacy';

export interface HostSession {
  sessionId: string;
  hostPub: string;
  expiresAt: number;
  uri: string;
  createdAt: number;
}

interface ActiveHostSession extends HostSession {
  secret: string;
}

let active: ActiveHostSession | null = null;
/** Session ids this device has already joined with — one-time use. */
const usedCodes = new Set<string>();

const hex = (bytes: number) => toHex(randomBytes(bytes));

/** Reject anything that is not a live v2 code. */
export function parsePairingCode(uri: string, now = Date.now()):
  | { ok: true; code: PairingCode }
  | { ok: false; reason: CodeRejection } {
  const text = (uri ?? '').trim();
  if (!text) return { ok: false, reason: 'malformed' };
  if (text.toLowerCase().startsWith('veltravia-pair://join')) {
    // The old format carried the group key in the clear. Refuse it outright.
    return { ok: false, reason: 'legacy' };
  }
  if (!text.toLowerCase().startsWith(PAIR_V2_SCHEME)) return { ok: false, reason: 'scheme' };
  const params: Record<string, string> = {};
  const query = text.includes('?') ? text.slice(text.indexOf('?') + 1) : '';
  for (const part of query.split('&')) {
    const eq = part.indexOf('=');
    if (eq > 0) params[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
  }
  const sessionId = params.s ?? '';
  const hostPub = params.p ?? '';
  const expiresAt = Number(params.e ?? 0);
  if (!/^[0-9a-f]{16,64}$/i.test(sessionId)) return { ok: false, reason: 'malformed' };
  if (!/^[0-9a-f]{64}$/i.test(hostPub)) return { ok: false, reason: 'malformed' };
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return { ok: false, reason: 'malformed' };
  if (expiresAt <= now) return { ok: false, reason: 'expired' };
  // A v2 code must never carry key material.
  if (params.k || params.g || params.d || params.n) return { ok: false, reason: 'legacy' };
  return { ok: true, code: { sessionId, hostPub, expiresAt } };
}

export function buildPairingCode(code: PairingCode): string {
  return `${PAIR_V2_SCHEME}?s=${code.sessionId}&p=${code.hostPub}&e=${code.expiresAt}`;
}

/**
 * Six digits both devices can show. Derived from BOTH public keys, sorted so
 * each side computes the same value. Compared by the user, never transmitted.
 */
export function safetyNumber(aPub: string, bPub: string): string {
  const [first, second] = [aPub.toLowerCase(), bPub.toLowerCase()].sort();
  const hexDigest = digest(`${first}|${second}`, 'veltravia-pairing-sas');
  const n = BigInt(`0x${hexDigest.slice(0, 12)}`) % 1_000_000n;
  return n.toString().padStart(6, '0');
}

async function persistActive(session: ActiveHostSession | null): Promise<void> {
  if (!session) {
    await Keychain.resetGenericPassword({ service: SESSION_SERVICE }).catch(() => {});
    return;
  }
  await Keychain.setGenericPassword('pairsession', JSON.stringify(session), {
    service: SESSION_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }).catch(() => {});
}

/** Start a pairing session on the existing device. */
export async function startPairingSession(now = Date.now()): Promise<HostSession> {
  await cancelPairingSession(); // one live session at a time
  const kp = nacl.box.keyPair();
  const session: ActiveHostSession = {
    sessionId: hex(16),
    hostPub: toHex(kp.publicKey),
    secret: toHex(kp.secretKey),
    createdAt: now,
    expiresAt: now + PAIRING_TTL_MS,
    uri: '',
  };
  session.uri = buildPairingCode({
    sessionId: session.sessionId,
    hostPub: session.hostPub,
    expiresAt: session.expiresAt,
  });
  active = session;
  await persistActive(session);
  await pairingRelay.open({
    sessionId: session.sessionId,
    hostPub: session.hostPub,
    expiresAt: session.expiresAt,
  }).catch(() => {});
  return { ...session, secret: undefined as unknown as string, ...{} } as HostSession;
}

/** The live session, if one has not expired. */
export function currentPairingSession(now = Date.now()): HostSession | null {
  if (!active) return null;
  if (active.expiresAt <= now) {
    active = null;
    return null;
  }
  const { secret: _secret, ...session } = active;
  return session;
}

/** Cancel (or let expire) the session. The relay entry is dropped too. */
export async function cancelPairingSession(): Promise<void> {
  if (!active) {
    await persistActive(null);
    return;
  }
  const { sessionId } = active;
  active = null;
  await persistActive(null);
  await pairingRelay.cancel(sessionId).catch(() => {});
}

/** Has this device already joined with this code? One-time use. */
export function codeAlreadyUsed(sessionId: string): boolean {
  return usedCodes.has(sessionId);
}

/** Tests only. */
export function __resetPairingSessionsForTests(): void {
  active = null;
  usedCodes.clear();
}

/** Waits `ms` unless the session is gone. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type HostWaitResult =
  | { status: 'joined'; joinerPub: string; safetyNumber: string }
  | { status: 'expired' }
  | { status: 'cancelled' }
  | { status: 'timeout' };

/**
 * Host side: wait for a joiner to publish its ephemeral public key. Stops when
 * the session expires or the user cancels (checked between polls).
 */
export async function waitForJoiner(now = () => Date.now()): Promise<HostWaitResult> {
  const session = currentPairingSession(now());
  if (!session) return { status: 'expired' };
  let state: PairingRelayState | null = null;
  for (;;) {
    if (now() >= session.expiresAt) {
      await cancelPairingSession();
      return { status: 'expired' };
    }
    if (!active) return { status: 'cancelled' };
    state = await pairingRelay.poll(session.sessionId).catch(() => null);
    if (state?.cancelled) {
      active = null;
      return { status: 'cancelled' };
    }
    if (state?.joinerPub) {
      if (!/^[0-9a-f]{64}$/i.test(state.joinerPub)) return { status: 'cancelled' };
      return {
        status: 'joined',
        joinerPub: state.joinerPub,
        safetyNumber: safetyNumber(session.hostPub, state.joinerPub),
      };
    }
    await sleep(POLL_MS);
  }
}

/**
 * Host side, after the user confirmed the six digits: hand the group material to
 * that one joiner and consume the session. Returns false if it has already gone.
 */
export async function approveJoiner(
  joinerPub: string,
  material: { groupId: string; key: string; epoch: number },
  now = Date.now(),
): Promise<boolean> {
  if (!active || active.expiresAt <= now) {
    await cancelPairingSession();
    return false;
  }
  // Adding a device is additive: note what protects THIS device before the
  // hand-off, so nothing can be loosened by the pairing itself.
  const before = await captureProtections();
  const { sessionId, secret, hostPub } = active;
  const sealed = wrapFor(fromHex(secret), joinerPub, JSON.stringify({
    kind: 'veltravia-pair/1',
    groupId: material.groupId,
    key: material.key,
    epoch: material.epoch,
    hostPub,
    at: now,
  }));
  if (!sealed) return false;
  const delivered = await pairingRelay
    .deliver(sessionId, { sealed, hostPub })
    .then(() => true)
    .catch(() => false);
  // One-time: the session dies whether or not the relay acknowledged it.
  active = null;
  await persistActive(null);
  await restoreProtections(before);
  if (!delivered) return false;
  await pairingRelay.cancel(sessionId).catch(() => {});
  return true;
}

export type JoinResult =
  | { status: 'joined'; material: { groupId: string; key: string; epoch: number }; safetyNumber: string; hostPub: string }
  | { status: 'expired' }
  | { status: 'cancelled' }
  | { status: 'timeout' }
  | { status: 'used' }
  | { status: 'invalid' };

/**
 * Joiner side: publish our ephemeral public key, then wait for the host to hand
 * over material sealed to it. Everything here can fail safely — a wrong key or a
 * tampered ciphertext just yields 'invalid'.
 */
export async function joinPairingSession(
  code: PairingCode,
  now = () => Date.now(),
): Promise<JoinResult> {
  if (codeAlreadyUsed(code.sessionId)) return { status: 'used' };
  if (code.expiresAt <= now()) return { status: 'expired' };

  const kp = nacl.box.keyPair();
  const joinerPub = toHex(kp.publicKey);
  const declared = await pairingRelay.join(code.sessionId, joinerPub).then(() => true).catch(() => false);
  if (!declared) return { status: 'cancelled' };

  while (now() < code.expiresAt) {
    const state = await pairingRelay.poll(code.sessionId).catch(() => null);
    // Delivery wins over cancellation: the host hands the material over and then
    // closes the session, so a late poll must still read what was sent.
    if (state?.sealed) {
      const plain = unwrapWith(kp.secretKey, code.hostPub, state.sealed);
      if (!plain) return { status: 'invalid' };
      try {
        const material = JSON.parse(plain) as { kind?: string; groupId?: string; key?: string; epoch?: number; hostPub?: string };
        if (material.kind !== 'veltravia-pair/1') return { status: 'invalid' };
        if (!material.groupId || !/^[0-9a-f]{32,64}$/i.test(material.groupId)) return { status: 'invalid' };
        if (!material.key || !/^[0-9a-f]{64}$/i.test(material.key)) return { status: 'invalid' };
        if (material.hostPub !== code.hostPub) return { status: 'invalid' };
        usedCodes.add(code.sessionId);
        return {
          status: 'joined',
          material: { groupId: material.groupId, key: material.key, epoch: material.epoch ?? 0 },
          safetyNumber: safetyNumber(code.hostPub, joinerPub),
          hostPub: code.hostPub,
        };
      } catch {
        return { status: 'invalid' };
      }
    }
    if (state?.cancelled) return { status: 'cancelled' };
    await sleep(POLL_MS);
  }
  return { status: 'expired' };
}
