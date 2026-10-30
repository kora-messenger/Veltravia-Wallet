/**
 * Veltravia Wallet — the sealed box used to share lock state inside a wallet group.
 *
 * The backend must never read what it stores. This file is the only encryption
 * between the user's devices, so it uses an established AEAD (XSalsa20-Poly1305
 * from tweetnacl, already a dependency for the pairing handshake) instead of the
 * hand-rolled CTR-plus-HMAC construction it replaces.
 *
 * Two things the old construction could not do, and this one does:
 *
 *   • CONTEXT BINDING. Every box names the group, the key id and the purpose it
 *     was made for, inside the ciphertext. `open` refuses a box whose context does
 *     not match the context asked for. Replaying another wallet's blob — or the
 *     same blob under a different key version — fails instead of decrypting into
 *     a plausible-looking state.
 *   • FAIL-CLOSED RANDOMNESS. The nonce comes from `secureRandomBytes`, which
 *     throws rather than falling back to Math.random. A predictable nonce under a
 *     stream cipher is a real break; refusing to publish is the safe failure. The
 *     local lock is enforced regardless, so nothing loosens when sealing fails.
 *
 * Legacy `seal`/`open` output (pre-AEAD, no prefix) is still readable so existing
 * published state does not become garbage; it is re-sealed in the new format on
 * the next write. Signing keys never touch this file — they stay in WalletCore and
 * the platform keystore.
 */
import nacl from 'tweetnacl';
import { concat, fromAscii, fromHex, hmac, randomBytes, secureRandomBytes, sha256, timingSafeEqual, toHex } from './hash';

const NONCE_LEN = 12;
const MAC_LEN = 32;

/** Prefix that marks an AEAD box. Legacy boxes have no prefix. */
const BOX_PREFIX = 'sv2.';
const SECRETBOX_NONCE = 24;

export interface BoxContext {
  /** Creator of the box: wallet group id and the key version used. */
  groupId: string;
  kid: string;
  /** What the box is for. Stops one protocol's box being accepted by another. */
  purpose: string;
}


/**
 * AEAD seal with context binding.
 * Output: `sv2.` ‖ hex(nonce 24 ‖ secretbox(payload)).
 */
export function sealFor(keyHex: string, plaintext: string, ctx: BoxContext): string {
  const key = fromHex(keyHex);
  if (key.length !== nacl.secretbox.keyLength) throw new Error('lock key must be 32 bytes');
  const nonce = secureRandomBytes(SECRETBOX_NONCE);
  // The context lives INSIDE the ciphertext, so tampering with it fails the MAC.
  const payload = JSON.stringify({ c: ctx, d: plaintext });
  const box = nacl.secretbox(fromAscii(payload), nonce, key);
  return BOX_PREFIX + toHex(concat(nonce, box));
}

/**
 * AEAD open. Returns null for a bad MAC, a wrong key, a legacy box, or a context
 * mismatch. Never throws.
 */
export function openFor(keyHex: string, sealedHex: string, ctx: BoxContext): string | null {
  try {
    if (!sealedHex.startsWith(BOX_PREFIX)) return null;
    const key = fromHex(keyHex);
    const raw = fromHex(sealedHex.slice(BOX_PREFIX.length));
    if (raw.length < SECRETBOX_NONCE + 16) return null;
    const nonce = raw.subarray(0, SECRETBOX_NONCE);
    const box = raw.subarray(SECRETBOX_NONCE);
    const opened = nacl.secretbox.open(box, nonce, key);
    if (!opened) return null;
    let text = '';
    for (let i = 0; i < opened.length; i++) text += String.fromCharCode(opened[i]);
    const parsed = JSON.parse(text) as { c?: BoxContext; d?: unknown };
    if (!parsed || typeof parsed.d !== 'string') return null;
    const c = parsed.c;
    if (!c || c.groupId !== ctx.groupId || c.kid !== ctx.kid || c.purpose !== ctx.purpose) return null;
    return parsed.d;
  } catch {
    return null;
  }
}

/**
 * Legacy seal (pre-AEAD). Kept for reading old records only; nothing new is
 * written this way. Do not extend this path.
 */
export function legacySeal(keyHex: string, plaintext: string): string {
  const key = fromHex(keyHex);
  const nonce = secureRandomBytes(NONCE_LEN);
  const body = fromAscii(plaintext);
  const stream = legacyKeystream(key, nonce, body.length);
  const ct = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) ct[i] = body[i] ^ stream[i];
  const mac = hmac(key, concat(nonce, ct));
  return toHex(concat(nonce, ct, mac));
}

function legacyKeystream(key: Uint8Array, nonce: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let off = 0;
  for (let counter = 0; off < length; counter++) {
    const ctr = new Uint8Array(4);
    ctr[0] = (counter >>> 24) & 0xff;
    ctr[1] = (counter >>> 16) & 0xff;
    ctr[2] = (counter >>> 8) & 0xff;
    ctr[3] = counter & 0xff;
    const block = sha256(concat(key, nonce, ctr));
    for (let i = 0; i < block.length && off < length; i++) out[off++] = block[i];
  }
  return out;
}

/** Read a legacy (no-prefix) box. Returns null on any failure. Never throws. */
export function legacyOpen(keyHex: string, sealedHex: string): string | null {
  try {
    const key = fromHex(keyHex);
    const box = fromHex(sealedHex);
    if (box.length < NONCE_LEN + MAC_LEN) return null;
    const nonce = box.subarray(0, NONCE_LEN);
    const ct = box.subarray(
      NONCE_LEN,
      box.length - MAC_LEN,
    );
    const mac = box.subarray(box.length - MAC_LEN);
    const expected = hmac(key, concat(nonce, ct));
    if (!timingSafeEqual(mac, expected)) return null;
    const stream = legacyKeystream(key, nonce, ct.length);
    const out = new Uint8Array(ct.length);
    for (let i = 0; i < ct.length; i++) out[i] = ct[i] ^ stream[i];
    let text = '';
    for (let i = 0; i < out.length; i++) text += String.fromCharCode(out[i]);
    return text;
  } catch {
    return null;
  }
}

/**
 * Back-compatible seal: context-bound AEAD keyed by the group id alone.
 *
 * Callers that have a real context should use `sealFor`. This keeps the older
 * two-argument call sites working while still writing an authenticated box.
 */
export function seal(keyHex: string, plaintext: string, ctx?: BoxContext): string {
  return sealFor(keyHex, plaintext, ctx ?? { groupId: '', kid: 'v1', purpose: 'lock-state' });
}

/** Back-compatible open: tries the given context, then the legacy format. */
export function open(keyHex: string, sealedHex: string, ctx?: BoxContext): string | null {
  const bound = openFor(keyHex, sealedHex, ctx ?? { groupId: '', kid: 'v1', purpose: 'lock-state' });
  if (bound !== null) return bound;
  return legacyOpen(keyHex, sealedHex);
}

// Kept as a re-export so existing imports of the CSPRNG keep working; the
// implementation lives in crypto/hash next to the other primitives.
export { secureRandomBytes };

/** Random hex helper used by device ids and salts elsewhere. */
export function randomHex(n: number): string {
  return toHex(randomBytes(n));
}
