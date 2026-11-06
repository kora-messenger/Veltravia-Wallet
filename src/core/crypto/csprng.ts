/**
 * Veltravia Wallet — the app's CSPRNG, and the Web `crypto` shim.
 *
 * Hermes ships no `crypto.getRandomValues`. The seed generator and the
 * authenticated-box nonces call `secureRandomBytes`, which correctly refuses to
 * fall back to Math.random — so on a release build with no polyfill, wallet
 * creation died at "no CSPRNG available: refusing to generate a nonce"
 * (Ijezie, 6 Nov 2026). Nothing was insecure; the app simply had no entropy
 * source to reach.
 *
 * The source is now native: `RandomModule` in android/app exposes the platform
 * `java.security.SecureRandom` over a blocking synchronous bridge call (the Web
 * API is synchronous, so a promise could not satisfy it). This file turns that
 * into `globalThis.crypto.getRandomValues` at startup, and gives callers a
 * direct `nativeRandomBytes` for when the shim is not what they want.
 */
import { NativeModules } from 'react-native';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Hermes-safe base64 decode (no atob, no Buffer). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64.indexOf(clean[i]);
    if (v < 0) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

interface RandomNativeModule {
  getRandomBase64(byteCount: number): string;
  getRandomBase64Async?(byteCount: number): Promise<string>;
}

/**
 * Entropy drawn ahead of time from the async bridge call.
 *
 * A bridgeless host can refuse a synchronous native call, which would leave the
 * shim with nothing to hand a caller that must not block. JS therefore pulls a
 * few kilobytes at startup and drains this pool when the sync path is unusable.
 */
let pool: Uint8Array | null = null;

function randomModule(): RandomNativeModule | null {
  const mod = (NativeModules as unknown as { RandomModule?: RandomNativeModule }).RandomModule;
  return mod && typeof mod.getRandomBase64 === 'function' ? mod : null;
}

/**
 * `n` bytes from the platform CSPRNG, or null when the native module is not
 * present (Jest, the OTA-updated bundle running before the module shipped).
 */
/** Fill the pool from the platform's async call. Safe to call more than once. */
export async function primeCsprngPool(byteCount = 4096): Promise<boolean> {
  const mod = randomModule();
  if (!mod?.getRandomBase64Async) return false;
  try {
    const bytes = base64ToBytes(await mod.getRandomBase64Async(byteCount));
    if (bytes.length < 8) return false; // a stub answer is not entropy
    pool = pool && pool.length ? concat(pool, bytes) : bytes;
    return true;
  } catch {
    return false;
  }
}

/** Drop any buffered entropy (used when a caller must start from zero). */
export function clearCsprngPool(): void {
  pool = null;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function fromPool(n: number): Uint8Array | null {
  if (!pool || pool.length < n) return null;
  const out = pool.slice(0, n);
  pool = pool.slice(n);
  return out;
}

export function nativeRandomBytes(n: number): Uint8Array | null {
  const mod = randomModule();
  if (!mod) return null;
  try {
    const out = base64ToBytes(mod.getRandomBase64(n));
    if (out.length === n) return out;
  } catch {
    // Synchronous bridge refused (common under bridgeless): use the pool.
  }
  return fromPool(n);
}

/** True when this process can produce cryptographically secure randomness. */
export function csprngAvailable(): boolean {
  const g = globalThis as { crypto?: { getRandomValues?: unknown } };
  if (typeof g.crypto?.getRandomValues === 'function') return true;
  if (pool && pool.length > 0) return true;
  return nativeRandomBytes(1) !== null;
}

/**
 * Install `globalThis.crypto.getRandomValues` if the engine lacks it.
 *
 * Fills the caller's view in place, exactly as the Web API does, and rejects
 * non-integer views the same way. Returns whether a CSPRNG is available after
 * the attempt.
 */
export function installCsprng(): boolean {
  const g = globalThis as any;
  if (typeof g.crypto?.getRandomValues === 'function') return true;
  if (!randomModule()) return false;

  const getRandomValues = <T extends ArrayBufferView>(array: T): T => {
    const view = array as unknown as { byteLength: number; buffer: ArrayBuffer; byteOffset: number };
    if (typeof view?.byteLength !== 'number') {
      throw new TypeError('getRandomValues expects an integer TypedArray');
    }
    const bytes = nativeRandomBytes(view.byteLength);
    if (!bytes) throw new Error('no CSPRNG available: refusing to generate a nonce');
    new Uint8Array(view.buffer, view.byteOffset, view.byteLength).set(bytes);
    return array;
  };

  const target = g.crypto && typeof g.crypto === 'object' ? g.crypto : {};
  try {
    Object.defineProperty(target, 'getRandomValues', { value: getRandomValues, configurable: true, writable: true });
  } catch {
    target.getRandomValues = getRandomValues;
  }
  try {
    g.crypto = target;
  } catch {
    // Engine refused the assignment: callers fall back to nativeRandomBytes.
    return nativeRandomBytes(1) !== null;
  }
  return true;
}
