/**
 * Self-hosted, signed over-the-air JavaScript updates.
 *
 * What it can and cannot do:
 *  - It ships JS and assets only. Native code, permissions and the WalletCore
 *    bridge still need a real APK.
 *  - The manifest must be Ed25519-signed by the key pinned in `key.ts`. The
 *    signature covers the bundle's URL, size and SHA-256, so neither the host
 *    nor the network can substitute different code.
 *  - The native side downloads and hashes; JS never hands over raw bytes, so a
 *    compromised JS context cannot install something unsigned.
 *  - A bundle that does not boot three times is deleted by `OtaStore` and the
 *    app falls back to the copy inside the APK.
 */
import nacl from 'tweetnacl';
import Config from 'react-native-config';
import { NativeModules } from 'react-native';
import { OTA_PUBLIC_KEY } from './key';

export interface OtaManifest {
  version: string;
  createdAt: string;
  minAppVersion?: string;
  bundle: { url: string; sha256: string; size: number };
  sig: string; // base64 Ed25519 over canonicalPayload(manifest)
}

export interface OtaState {
  version: string | null;
  sha256: string | null;
  size: number;
  attempts: number;
  bundlePresent: boolean;
}

export interface OtaNative {
  state(): Promise<OtaState>;
  install(url: string, sha256: string, version: string): Promise<boolean>;
  confirmBoot(): void;
  clear(): void;
}

/**
 * Read on every call, never captured: the module is absent in Jest, in an APK
 * older than this feature, and (transiently) while React Native is starting up.
 */
const otaNative = (): OtaNative | undefined => (NativeModules as any)?.VeltraviaOta as OtaNative | undefined;

export const otaNativeAvailable = () => !!otaNative();

/**
 * The exact bytes that get signed. Field order and formatting are fixed here so
 * the publisher cannot sign one thing and ship another.
 */
export function canonicalPayload(m: Omit<OtaManifest, 'sig'>): string {
  return JSON.stringify({
    version: m.version,
    createdAt: m.createdAt,
    minAppVersion: m.minAppVersion ?? '',
    url: m.bundle.url,
    sha256: m.bundle.sha256.toLowerCase(),
    size: m.bundle.size,
  });
}

const sha256Shape = /^[0-9a-f]{64}$/;

/** Verify a manifest before anything is downloaded. */
export function verifyManifest(
  raw: unknown,
  publicKeyB64: string = OTA_PUBLIC_KEY,
): { ok: true; manifest: OtaManifest } | { ok: false; reason: string } {
  const m = raw as OtaManifest;
  if (!m || typeof m !== 'object') return { ok: false, reason: 'not an object' };
  if (typeof m.version !== 'string' || !m.version.trim()) return { ok: false, reason: 'no version' };
  if (typeof m.sig !== 'string' || !m.sig) return { ok: false, reason: 'unsigned' };
  if (!m.bundle || typeof m.bundle.url !== 'string' || !m.bundle.url) {
    return { ok: false, reason: 'no bundle url' };
  }
  if (typeof m.bundle.sha256 !== 'string' || !sha256Shape.test(m.bundle.sha256.toLowerCase())) {
    return { ok: false, reason: 'bad hash' };
  }
  if (typeof m.bundle.size !== 'number' || !(m.bundle.size > 0)) {
    return { ok: false, reason: 'bad size' };
  }
  // https only: an OTA bundle is code, and plain HTTP would let anyone on the
  // path replay an old (still validly signed) bundle.
  if (!/^https:\/\//i.test(m.bundle.url)) return { ok: false, reason: 'not https' };

  let ok = false;
  try {
    ok = nacl.sign.detached.verify(
      utf8Bytes(canonicalPayload(m)),
      base64ToBytes(m.sig),
      base64ToBytes(publicKeyB64),
    );
  } catch {
    return { ok: false, reason: 'signature did not parse' };
  }
  return ok ? { ok: true, manifest: m } : { ok: false, reason: 'signature does not verify' };
}

/** Hermes does not always expose TextEncoder, so encode by hand (ASCII/UTF-8). */
export function utf8Bytes(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(++i);
      c = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return new Uint8Array(out);
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Hermes-safe base64 decode (no atob dependency). */
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** Numeric semver compare: is `a` newer than `b`? Missing parts count as 0. */
export function isNewer(a: string, b: string | null | undefined): boolean {
  if (!b) return true;
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

const APP_VERSION = '1.0.0'; // bumped with each store build; guards minAppVersion

export function manifestUrl(): string | null {
  const explicit = (Config as any)?.OTA_MANIFEST_URL;
  if (explicit && /^https:\/\//i.test(explicit)) return explicit;
  return null;
}

export type UpdateOutcome =
  | { status: 'no-native' }
  | { status: 'no-url' }
  | { status: 'up-to-date' }
  | { status: 'rejected'; reason: string }
  | { status: 'failed' }
  | { status: 'installed'; version: string };

/**
 * One check per launch. Never throws: a broken update channel must not stop the
 * wallet from opening.
 */
export async function checkForUpdate(
  opts: {
    url?: string | null;
    fetchImpl?: typeof fetch;
    publicKeyB64?: string;
    appVersion?: string;
  } = {},
): Promise<UpdateOutcome> {
  const native = otaNative();
  if (!native) return { status: 'no-native' };
  const url = opts.url ?? manifestUrl();
  if (!url) return { status: 'no-url' };
  const doFetch = opts.fetchImpl ?? fetch;

  try {
    const res = await doFetch(url, { cache: 'no-store' } as any);
    if (!res.ok) return { status: 'failed' };
    const raw = await res.json();
    const verified = verifyManifest(raw, opts.publicKeyB64 ?? OTA_PUBLIC_KEY);
    if (!verified.ok) return { status: 'rejected', reason: verified.reason };
    const manifest = verified.manifest;

    const current = await native.state();
    if (!isNewer(manifest.version, current.version)) return { status: 'up-to-date' };

    const appVersion = opts.appVersion ?? APP_VERSION;
    if (manifest.minAppVersion && isNewer(manifest.minAppVersion, appVersion)) {
      // This bundle expects native code this APK does not have.
      return { status: 'rejected', reason: 'needs a newer app version' };
    }

    const installed = await native.install(
      manifest.bundle.url,
      manifest.bundle.sha256.toLowerCase(),
      manifest.version,
    );
    return installed ? { status: 'installed', version: manifest.version } : { status: 'failed' };
  } catch {
    return { status: 'failed' };
  }
}

/** The app rendered: the bundle on disk is good, stop counting boot attempts. */
export function confirmBoot(): void {
  try {
    otaNative()?.confirmBoot();
  } catch {
    /* nothing to confirm */
  }
}

/** Where the running bundle came from, for Settings/About. */
export async function otaState(): Promise<OtaState | null> {
  const native = otaNative();
  if (!native) return null;
  try {
    return await native.state();
  } catch {
    return null;
  }
}
