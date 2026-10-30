/**
 * Veltravia Wallet — key derivation for the lock protocol.
 *
 * Two rules drive this file:
 *
 *   1. A lock key must never be a signing key, and a signing key must never be a
 *      lock key. Domain separation via HKDF is how we keep them apart even though
 *      both ultimately come from the same recovery phrase.
 *   2. Derivation must stay reproducible from the phrase alone, because that is
 *      what makes a recovered or paired device land in the same lock group.
 *
 * HKDF (RFC 5869) over the existing HMAC-SHA256 helper is used deliberately: the
 * input keying material is a 128/256-bit seed with full entropy, so a slow
 * password-style KDF would buy nothing here (those exist to stretch low-entropy
 * inputs). What matters is the label, which is what stops the lock key from being
 * the signing key by another name.
 *
 * HONEST LIMIT, worth stating in code rather than only in docs: domain separation
 * stops accidental key reuse. It does NOT protect a derived key from somebody who
 * already holds the recovery phrase — they hold everything. Anyone with the phrase
 * can derive the lock key, read the group's sealed state and unlock it.
 */
import { concat, fromAscii, fromHex, hmac, toHex } from './hash';
import { digest } from '../storage/passcode';

const HASH_LEN = 32;
const LABEL_V2 = 'veltravia/lock-state-key/v2';

/** RFC 5869 HKDF-Extract + HKDF-Expand, SHA-256. Bytes in, hex out. */
export function hkdf(ikm: Uint8Array, salt: Uint8Array, info: string, length = HASH_LEN): string {
  const prk = hmac(salt, ikm);
  let t: Uint8Array = new Uint8Array(0);
  let chunks: Uint8Array = new Uint8Array(0);
  const infoBytes = fromAscii(info);
  for (let counter = 1; counter <= Math.ceil(length / HASH_LEN); counter++) {
    t = hmac(prk, concat(t, infoBytes, new Uint8Array([counter])));
    chunks = concat(chunks, t);
  }
  return toHex(chunks.subarray(0, length));
}

/**
 * v2 lock-state key: HKDF-SHA256(seed, salt = groupId bytes, info = label).
 *
 * The phrase is used as its mnemonic text (the same bytes BIP39 itself hashes),
 * and the group id is used as raw salt bytes, not its hex spelling. Salting with
 * the group means a rotated group never shares a key with the group it replaced.
 */
export function lockKeyV2(seed: string, groupId: string): string {
  return hkdf(fromAscii(seed.normalize('NFKD')), fromHex(groupId), LABEL_V2);
}

/**
 * v1 key — the original derivation, kept byte-for-byte so wallets created before
 * the v2 scheme keep working. Delegates to the same `digest()` the wallet group
 * used, rather than reimplementing it: a re-implementation that differed by one
 * byte would orphan every existing wallet's lock state.
 */
export function lockKeyV1(seed: string): string {
  return digest(seed, 'veltravia-group-key-v1');
}

/** Key id reported to peers, so a reader knows which derivation to try first. */
export type LockKeyId = 'v1' | 'v2';

export interface LockKeyCandidate {
  kid: LockKeyId;
  key: string;
}

/**
 * Every key a device may hold for this wallet, most preferred first.
 *
 * Ordered v2 then v1: a fresh install publishes v2, while a wallet that predates
 * the change can still read its own v1 record and any peer's v1 record.
 */
export function lockKeyCandidates(seed: string, groupId: string): LockKeyCandidate[] {
  return [
    { kid: 'v2', key: lockKeyV2(seed, groupId) },
    { kid: 'v1', key: lockKeyV1(seed) },
  ];
}

/** Pick the key for a key id, falling back to the preferred key for unknown ids. */
export function lockKeyFor(kid: LockKeyId | string | undefined, seed: string, groupId: string): LockKeyCandidate {
  const candidates = lockKeyCandidates(seed, groupId);
  return candidates.find((c) => c.kid === kid) ?? candidates[0];
}
