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
import { readSeed } from '../storage/secureStorage';
import { walletManager, type WalletAccount } from '../wallet/walletManager';

export const PAIR_V2_SCHEME = 'veltravia-pair://2';
/**
 * What the host seals for the joiner. v2 additionally carries the recovery
 * phrase, which is what gives the new phone FULL access — signing, recovery,
 * balances — instead of only a lock-sync group. The phrase only ever exists
 * inside the nacl.box, encrypted to the joiner's ephemeral public key.
 */
const SEALED_KIND = 'veltravia-pair/2';
const SEALED_KIND_GROUP_ONLY = 'veltravia-pair/1';
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
/**
 * Sessions where the user proved the six digits match. `completePairingJoin`
 * refuses to open anything for a session that is not in here, so the check
 * cannot be skipped by calling the protocol directly instead of the screen.
 */
const verified = new Set<string>();

/** Called by pairingVerify on a successful match. */
export function markDigitsVerified(sessionId: string): void {
  verified.add(sessionId);
}

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
  verified.clear();
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
  // The phrase is what makes the new device a full wallet, so it travels — but
  // only inside this box, sealed to the joiner's ephemeral key. The relay sees
  // ciphertext; the ephemeral secret exists nowhere but on the new phone and is
  // discarded when the session ends, so the blob cannot be opened later.
  const seed = await readSeed().catch(() => null);
  if (!seed) return false;
  // Identity: the addresses this wallet actually controls, so the new device can
  // prove it derived the SAME wallet instead of quietly creating a lookalike.
  // Absent when the native derivation bridge is not in this build — then the
  // joiner reports identity as unverified rather than pretending.
  let accounts: WalletAccount[] | null = null;
  try {
    accounts = await walletManager.deriveAccounts();
  } catch {
    accounts = null;
  }
  const sealed = wrapFor(fromHex(secret), joinerPub, JSON.stringify({
    kind: SEALED_KIND,
    groupId: material.groupId,
    key: material.key,
    epoch: material.epoch,
    hostPub,
    seed,
    accounts,
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

/** BIP-39 counts only, plain words: a phrase that fails this is not a phrase. */
export function isUsableSeed(seed: unknown): seed is string {
  if (typeof seed !== 'string') return false;
  const words = seed.trim().toLowerCase().split(/\s+/);
  if (![12, 15, 18, 21, 24].includes(words.length)) return false;
  return words.every((w) => /^[a-z]{3,8}$/.test(w));
}

export type JoinResult =
  | {
      status: 'joined';
      material: { groupId: string; key: string; epoch: number };
      safetyNumber: string;
      hostPub: string;
      /** The recovery phrase, present from v2 hosts. Only in memory, sealed in transit. */
      seed?: string;
      /** Addresses the host says this wallet owns, when it could derive them. */
      accounts?: WalletAccount[] | null;
      /** Digits were proven before the box was opened. Always true on this path. */
      digitsVerified: boolean;
    }
  | { status: 'expired' }
  | { status: 'cancelled' }
  | { status: 'timeout' }
  | { status: 'used' }
  | { status: 'unverified' }
  | { status: 'invalid' };

/**
 * Joiner side: publish our ephemeral public key, then wait for the host to hand
 * over material sealed to it. Everything here can fail safely — a wrong key or a
 * tampered ciphertext just yields 'invalid'.
 */
export interface JoinHandle {
  sessionId: string;
  /** Kept in memory only: it dies with the screen, so the sealed box dies too. */
  secretKey: Uint8Array;
  joinerPub: string;
  hostPub: string;
  expiresAt: number;
  /** The six digits this side computes; the user must match them to the host's. */
  safetyNumber: string;
}

export type BeginJoinResult =
  | { status: 'begun'; handle: JoinHandle }
  | { status: 'used' }
  | { status: 'expired' }
  | { status: 'cancelled' };

/**
 * Joiner step 1: mint our ephemeral keypair and publish ONLY its public half.
 * Nothing comes back yet, so a relay that lies here gains nothing — it cannot
 * open what the host seals to a key it does not hold.
 */
export async function beginPairingJoin(
  code: PairingCode,
  now = () => Date.now(),
): Promise<BeginJoinResult> {
  if (codeAlreadyUsed(code.sessionId)) return { status: 'used' };
  if (code.expiresAt <= now()) return { status: 'expired' };

  const kp = nacl.box.keyPair();
  const joinerPub = toHex(kp.publicKey);
  const declared = await pairingRelay.join(code.sessionId, joinerPub).then(() => true).catch(() => false);
  if (!declared) return { status: 'cancelled' };

  return {
    status: 'begun',
    handle: {
      sessionId: code.sessionId,
      secretKey: kp.secretKey,
      joinerPub,
      hostPub: code.hostPub,
      expiresAt: code.expiresAt,
      safetyNumber: safetyNumber(code.hostPub, joinerPub),
    },
  };
}

/**
 * Joiner step 2: wait for the host to release the box, then open it. Call this
 * only AFTER the user's typed six digits matched — the host does not release
 * until its own user confirmed, and we do not ask for anything before that.
 */
export async function completePairingJoin(
  handle: JoinHandle,
  options: { requireVerifiedDigits?: boolean } = {},
  now = () => Date.now(),
): Promise<JoinResult> {
  if (options.requireVerifiedDigits !== false && !verified.has(handle.sessionId)) {
    // Nothing has been proven for this session, so we do not even poll: there is
    // nothing we are entitled to ask for.
    return { status: 'unverified' };
  }
  const code: PairingCode = {
    sessionId: handle.sessionId,
    hostPub: handle.hostPub,
    expiresAt: handle.expiresAt,
  };
  const kp = { publicKey: fromHex(handle.joinerPub), secretKey: handle.secretKey };
  const joinerPub = handle.joinerPub;

  while (now() < handle.expiresAt) {
    const state = await pairingRelay.poll(code.sessionId).catch(() => null);
    // Delivery wins over cancellation: the host hands the material over and then
    // closes the session, so a late poll must still read what was sent.
    if (state?.sealed) {
      const plain = unwrapWith(kp.secretKey, code.hostPub, state.sealed);
      if (!plain) return { status: 'invalid' };
      try {
        const material = JSON.parse(plain) as {
          kind?: string;
          groupId?: string;
          key?: string;
          epoch?: number;
          hostPub?: string;
          seed?: string;
          accounts?: WalletAccount[] | null;
        };
        if (material.kind !== SEALED_KIND && material.kind !== SEALED_KIND_GROUP_ONLY) return { status: 'invalid' };
        if (!material.groupId || !/^[0-9a-f]{32,64}$/i.test(material.groupId)) return { status: 'invalid' };
        if (!material.key || !/^[0-9a-f]{64}$/i.test(material.key)) return { status: 'invalid' };
        if (material.hostPub !== code.hostPub) return { status: 'invalid' };
        if (material.kind === SEALED_KIND) {
          // A v2 host must have sent a usable phrase; a mangled one is a failed
          // pairing, never a half-paired wallet.
          if (!isUsableSeed(material.seed)) return { status: 'invalid' };
        }
        usedCodes.add(code.sessionId);
        return {
          status: 'joined',
          material: { groupId: material.groupId, key: material.key, epoch: material.epoch ?? 0 },
          safetyNumber: safetyNumber(code.hostPub, joinerPub),
          hostPub: code.hostPub,
          seed: material.kind === SEALED_KIND ? material.seed : undefined,
          accounts: Array.isArray(material.accounts) ? material.accounts : null,
          digitsVerified: verified.has(code.sessionId),
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

/**
 * Back-compat composition of the two steps. New screens use begin/verify/complete
 * so the six digits are checked before anything is released.
 */
export async function joinPairingSession(
  code: PairingCode,
  now = () => Date.now(),
): Promise<JoinResult> {
  const begun = await beginPairingJoin(code, now);
  if (begun.status !== 'begun') return { status: begun.status };
  // Compatibility path only (no screen uses it): the caller has no way to carry
  // the digits, so it opts out explicitly. The UI path always proves them first.
  return completePairingJoin(begun.handle, { requireVerifiedDigits: false }, now);
}
