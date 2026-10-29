/**
 * Veltravia Wallet — the sealed box used to share lock state inside a wallet group.
 *
 * The backend must never read what it stores, and we refuse to add a native
 * crypto dependency that could break the Android build. So: a SHA-256 counter
 * keystream for confidentiality (encrypt-then-MAC with HMAC-SHA256), keyed by
 * the wallet group key, with a fresh random nonce per message.
 *
 * Honest scope: this is a well-formed construction (CTR keystream from a PRF +
 * encrypt-then-MAC + constant-time compare), not a libsodium replacement. It
 * protects lock state from a curious or compromised server. Signing keys never
 * touch it — those stay in WalletCore and the hardware keystore.
 */
import { concat, fromAscii, fromHex, hmac, randomBytes, sha256, timingSafeEqual, toHex } from './hash';

const NONCE_LEN = 12;
const MAC_LEN = 32;

function keystream(key: Uint8Array, nonce: Uint8Array, length: number): Uint8Array {
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

/** Encrypt-then-MAC. Output: nonce ‖ ciphertext ‖ mac, hex. */
export function seal(keyHex: string, plaintext: string): string {
  const key = fromHex(keyHex);
  const nonce = randomBytes(NONCE_LEN);
  const body = fromAscii(plaintext);
  const stream = keystream(key, nonce, body.length);
  const ct = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) ct[i] = body[i] ^ stream[i];
  const mac = hmac(key, concat(nonce, ct));
  return toHex(concat(nonce, ct, mac));
}

/** Returns null on a bad MAC, a short box or a wrong key. Never throws. */
export function open(keyHex: string, sealedHex: string): string | null {
  try {
    const key = fromHex(keyHex);
    const box = fromHex(sealedHex);
    if (box.length < NONCE_LEN + MAC_LEN) return null;
    const nonce = box.subarray(0, NONCE_LEN);
    const ct = box.subarray(NONCE_LEN, box.length - MAC_LEN);
    const mac = box.subarray(box.length - MAC_LEN);
    const expected = hmac(key, concat(nonce, ct));
    if (!timingSafeEqual(mac, expected)) return null;
    const stream = keystream(key, nonce, ct.length);
    const out = new Uint8Array(ct.length);
    for (let i = 0; i < ct.length; i++) out[i] = ct[i] ^ stream[i];
    let text = '';
    for (let i = 0; i < out.length; i++) text += String.fromCharCode(out[i]);
    return text;
  } catch {
    return null;
  }
}
