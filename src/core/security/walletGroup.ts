/**
 * Veltravia Wallet — wallet groups: "this wallet is on these devices".
 *
 * THE SEED IS THE IDENTITY, as in Trust Wallet. A wallet recovered from its
 * recovery phrase on another device derives the same group id and the same
 * group key, so it is instantly the same wallet: lock it on one phone and the
 * others block, unlock on ANY of them and they all clear. No pairing ceremony
 * is needed for the normal recovery path.
 *
 * Cost of that convenience, stated plainly: the group key is derived from the
 * recovery phrase, so anyone who has the phrase can read the group's lock state
 * and appear in the device list. They can also already spend the funds, so this
 * does not widen fund risk — but a removed device that still holds the phrase
 * can keep reading, and "remove" alone cannot revoke it. Key rotation therefore
 * only applies to a paired group (a wallet with no seed, or an explicit pairing).
 *
 * The backend is told an opaque group id (a slow digest of the seed, 3000
 * rounds) and nothing else. The lock state is sealed with the group key (see
 * groupCrypto.ts), so a server stores ciphertext it cannot read.
 */
import * as Keychain from 'react-native-keychain';
import nacl from 'tweetnacl';
import { concat, fromAscii, fromHex, randomBytes, sha256, toHex } from '../crypto/hash';
import { digest } from '../storage/passcode';
import { readSeed } from '../storage/secureStorage';

const SERVICE = 'com.veltravia.wallet.walletgroup';
const DEVICE_SERVICE = 'com.veltravia.wallet.deviceid';
const DEVICE_KEY_SERVICE = 'com.veltravia.wallet.devicekey';
const PAIR_SCHEME = 'veltravia-pair://join';
export const PAIRING_TTL_MS = 5 * 60 * 1000;

export interface GroupDevice {
  id: string;
  name: string;
  addedAt: number;
  /** X25519 public key. Lets a rotation address this device only. */
  pub?: string;
}

/**
 * A key rotation for the NEXT epoch. Everyone still holding the current key can
 * read this object, but only a device with a matching envelope can unwrap the
 * new key — which is what makes a removal stick.
 */
export interface Rotation {
  epoch: number;
  /** Key for `epoch`, already wrapped per device. */
  envelopes: Record<string, string>;
  /** Author's public key, so a recipient can unwrap its own envelope. */
  by: string;
}

export interface WalletGroup {
  groupId: string;
  /** Group key, hex. Seed-derived, or rotated when a PAIRED device is removed. */
  key: string;
  createdAt: number;
  devices: GroupDevice[];
  /** Where the identity came from. */
  source?: 'seed' | 'pairing';
  /** Rotation counter. 0 = the key derived straight from the phrase. */
  epoch?: number;
  /** This device's X25519 public key (the secret never leaves the keystore). */
  pub?: string;
  /** Set when the server had state this device could no longer read. */
  removedAt?: number;
  /**
   * A rotation this device authored and has not confirmed uploaded yet.
   * `underKey` is the key that epoch's peers still hold, so the announcement
   * itself can be sealed for them (and not for the removed device).
   */
  pendingRotation?: Rotation & { underKey: string };
}

export type PairingResult =
  | { ok: true; groupId: string; key: string; devices: GroupDevice[]; epoch?: number; pub?: string }
  | { ok: false; reason: 'malformed' | 'expired' | 'scheme' | 'legacy' };

let cache: WalletGroup | null = null;
let deviceIdCache: string | null = null;

const hex = (n: number) => toHex(randomBytes(n));

/**
 * The group for a wallet whose seed we can read: deterministic, so a second
 * device lands on the same record without any pairing step.
 */
export function deriveSeedGroup(seed: string): { groupId: string; key: string } {
  return {
    // 3000-round salted digest, truncated: a stable but costly-to-compute id.
    groupId: digest(seed, 'veltravia-group-id-v1').slice(0, 32),
    key: digest(seed, 'veltravia-group-key-v1'),
  };
}

async function readSeedSafely(): Promise<string | null> {
  try {
    const seed = await readSeed();
    return seed && seed.trim() ? seed : null;
  } catch {
    return null;
  }
}

async function readStored(): Promise<WalletGroup | null> {
  try {
    const res = await Keychain.getGenericPassword({ service: SERVICE });
    if (res === false) return null;
    const parsed = JSON.parse(res.password);
    if (!parsed || typeof parsed.groupId !== 'string' || typeof parsed.key !== 'string') return null;
    return {
      groupId: parsed.groupId,
      key: parsed.key,
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
      devices: Array.isArray(parsed.devices)
        ? parsed.devices.filter((d: any) => d && typeof d.id === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

async function persist(group: WalletGroup | null): Promise<void> {
  cache = group;
  if (!group) {
    await Keychain.resetGenericPassword({ service: SERVICE }).catch(() => {});
    return;
  }
  await Keychain.setGenericPassword('group', JSON.stringify(group), { service: SERVICE });
}

/** Stable per-install device id — random, not a hardware identifier. */
export async function deviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  try {
    const res = await Keychain.getGenericPassword({ service: DEVICE_SERVICE });
    if (res !== false && res.password) {
      deviceIdCache = res.password;
      return res.password;
    }
  } catch {
    /* create below */
  }
  const id = hex(8);
  deviceIdCache = id;
  await Keychain.setGenericPassword('device', id, { service: DEVICE_SERVICE }).catch(() => {});
  return id;
}

let keyPairCache: { secret: Uint8Array; public: string } | null = null;

/**
 * This device's X25519 keypair, kept in the keystore. The public half is shared
 * (it rides in the device list); the secret half is what makes a rotation
 * addressable to this device alone.
 */
export async function deviceKeyPair(): Promise<{ secret: Uint8Array; public: string }> {
  if (keyPairCache) return keyPairCache;
  try {
    const res = await Keychain.getGenericPassword({ service: DEVICE_KEY_SERVICE });
    if (res !== false && res.password) {
      const parsed = JSON.parse(res.password);
      if (typeof parsed?.secret === 'string' && typeof parsed?.public === 'string') {
        keyPairCache = { secret: fromHex(parsed.secret), public: parsed.public };
        return keyPairCache;
      }
    }
  } catch {
    /* create below */
  }
  const kp = nacl.box.keyPair();
  keyPairCache = { secret: kp.secretKey, public: toHex(kp.publicKey) };
  await Keychain.setGenericPassword(
    'devicekey',
    JSON.stringify({ secret: toHex(kp.secretKey), public: keyPairCache.public }),
    { service: DEVICE_KEY_SERVICE, accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  ).catch(() => {});
  return keyPairCache;
}

/** Wrap `plaintext` for one device (host side). */
export function wrapFor(mySecret: Uint8Array, theirPubHex: string, plaintext: string): string | null {
  try {
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const shared = nacl.box.before(fromHex(theirPubHex), mySecret);
    const boxed = nacl.box.after(fromAscii(plaintext), nonce, shared);
    return toHex(concat(nonce, boxed));
  } catch {
    return null;
  }
}

/** Unwrap one envelope addressed to this device, or null if it is not ours. */
export function unwrapWith(mySecret: Uint8Array, theirPubHex: string, payloadHex: string): string | null {
  try {
    const raw = fromHex(payloadHex);
    const nonce = raw.slice(0, nacl.box.nonceLength);
    const boxed = raw.slice(nacl.box.nonceLength);
    const shared = nacl.box.before(fromHex(theirPubHex), mySecret);
    const opened = nacl.box.open.after(boxed, nonce, shared);
    if (!opened) return null;
    return String.fromCharCode(...opened);
  } catch {
    return null;
  }
}

/**
 * Turn the pending rotation into the group's live key, if this device has an
 * envelope for itself. Returns true when the key changed.
 */
export async function applyRotation(rotation: Rotation | null | undefined): Promise<boolean> {
  if (!rotation || typeof rotation.epoch !== 'number') return false;
  const group = await getGroup();
  if (!group) return false;
  if ((group.epoch ?? 0) >= rotation.epoch) return false;
  const mine = rotation.envelopes?.[await deviceId()];
  if (!mine || !rotation.by) return false; // addressed to other devices: we were removed
  const pair = await deviceKeyPair();
  const key = unwrapWith(pair.secret, rotation.by, mine);
  if (!key || !/^[0-9a-f]{64}$/i.test(key)) return false;
  await persist({ ...group, key, epoch: rotation.epoch, removedAt: undefined });
  return true;
}

/** Record that this device can no longer read the group's state. */
export async function markRemoved(): Promise<void> {
  const group = await getGroup();
  if (!group || group.removedAt) return;
  await persist({ ...group, removedAt: Date.now() });
}

/** True when this device was removed from the wallet's lock group. */
export function groupRemoved(): boolean {
  return !!cache?.removedAt;
}

export async function getGroup(): Promise<WalletGroup | null> {
  if (cache) return cache;
  const stored = await readStored();
  const seed = await readSeedSafely();
  if (seed) {
    const { groupId, key } = deriveSeedGroup(seed);
    const own = await deviceId();
    const pub = (await deviceKeyPair()).public;
    // The phrase gives this wallet's IDENTITY. The key, however, is whatever
    // this device last held: after a rotation a removed device must NOT silently
    // re-derive its way back in.
    if (stored && stored.groupId === groupId) {
      cache = { ...stored, pub: stored.pub ?? pub };
      return cache;
    }
    cache = {
      groupId,
      key,
      createdAt: stored?.createdAt ?? Date.now(),
      devices: [{ id: own, name: 'This device', addedAt: Date.now(), pub }],
      source: 'seed',
      epoch: 0,
      pub,
    };
    await persist(cache);
    return cache;
  }
  cache = stored;
  return cache;
}

/** Synchronous read of the cached group (guards run on the render path). */
export function currentGroup(): WalletGroup | null {
  return cache;
}

export async function ensureGroup(deviceName = 'This device'): Promise<WalletGroup> {
  const existing = await getGroup();
  if (existing) {
    // Make sure this device is listed, even when the wallet was recovered.
    const own = await deviceId();
    if (existing.removedAt) return existing; // removed devices do not re-add themselves
    const pub = (await deviceKeyPair()).public;
    if (!existing.devices.some((d) => d.id === own)) {
      const next: WalletGroup = {
        ...existing,
        pub,
        devices: [...existing.devices, { id: own, name: deviceName, addedAt: Date.now(), pub }],
      };
      await persist(next);
      return next;
    }
    return existing;
  }
  const id = await deviceId();
  const pub = (await deviceKeyPair()).public;
  const group: WalletGroup = {
    groupId: hex(16),
    key: hex(32),
    createdAt: Date.now(),
    devices: [{ id, name: deviceName, addedAt: Date.now(), pub }],
    epoch: 0,
    pub,
  };
  await persist(group);
  return group;
}

/** Adopt a group from a scanned pairing code (the joining device calls this). */
export async function joinGroup(payload: PairingResult, deviceName = 'This device'): Promise<WalletGroup | null> {
  if (!payload.ok) return null;
  const id = await deviceId();
  const pub = (await deviceKeyPair()).public;
  const group: WalletGroup = {
    groupId: payload.groupId,
    key: payload.key,
    createdAt: Date.now(),
    devices: mergeDevices([{ id, name: deviceName, addedAt: Date.now(), pub }], payload.devices ?? []),
    source: 'pairing',
    epoch: payload.epoch ?? 0,
    pub,
  };
  await persist(group);
  return group;
}

/**
 * Adopt a group from a completed pairing handshake. The key never travelled in
 * the code: it arrived sealed to this device's ephemeral key, after both sides
 * confirmed the same safety number.
 */
export async function adoptPairingMaterial(
  material: { groupId: string; key: string; epoch: number },
  deviceName = 'This device',
): Promise<WalletGroup | null> {
  if (!/^[0-9a-f]{32,64}$/i.test(material.groupId)) return null;
  if (!/^[0-9a-f]{64}$/i.test(material.key)) return null;
  const id = await deviceId();
  const pub = (await deviceKeyPair()).public;
  const group: WalletGroup = {
    groupId: material.groupId,
    key: material.key,
    createdAt: Date.now(),
    devices: [{ id, name: deviceName, addedAt: Date.now(), pub }],
    source: 'pairing',
    epoch: material.epoch ?? 0,
    pub,
  };
  await persist(group);
  return group;
}

/** Register another device in the cached list (the old device does this). */
export async function addDevice(name: string): Promise<WalletGroup | null> {
  const group = await getGroup();
  if (!group) return null;
  const id = hex(8);
  const next: WalletGroup = {
    ...group,
    devices: [...group.devices, { id, name, addedAt: Date.now() }],
  };
  await persist(next);
  return next;
}

/**
 * Remove a device and rotate the group key. Anything sealed with the old key
 * (including future lock state) is unreadable to the removed device.
 */
export async function revokeDevice(id: string): Promise<WalletGroup | null> {
  const group = await getGroup();
  if (!group) return null;
  const own = await deviceId();
  if (id === own) return group; // never strand this device by deleting itself

  const remaining = group.devices.filter((d) => d.id !== id);
  const pair = await deviceKeyPair();
  const epoch = (group.epoch ?? 0) + 1;
  const newKey = hex(32);

  // Address the new key to everyone EXCEPT the removed device. It still holds
  // the old key and can read this rotation object, but has no envelope, so the
  // next epoch stays out of reach.
  const envelopes: Record<string, string> = {};
  for (const d of remaining) {
    // This device already holds the new key; only peers need an envelope.
    if (!d.pub || d.id === own) continue;
    const boxed = wrapFor(pair.secret, d.pub, newKey);
    if (boxed) envelopes[d.id] = boxed;
  }

  const next: WalletGroup = {
    ...group,
    key: newKey,
    epoch,
    devices: remaining,
    pendingRotation: { epoch, envelopes, by: pair.public, underKey: group.key },
  };
  await persist(next);
  return next;
}

/** Called once the rotation has been published: nothing left to announce. */
export async function clearPendingRotation(): Promise<void> {
  const group = await getGroup();
  if (!group?.pendingRotation) return;
  await persist({ ...group, pendingRotation: undefined });
}

/** The rotation to advertise in the next upload, if any. */
export function pendingRotationForUpload(): (Rotation & { underKey: string }) | null {
  return cache?.pendingRotation ?? null;
}

/** Union of two device lists, by id. Newest name wins. */
export function mergeDevices(current: GroupDevice[], incoming: GroupDevice[]): GroupDevice[] {
  const byId = new Map<string, GroupDevice>();
  for (const d of [...current, ...incoming]) {
    // ids are hex from randomBytes(8); anything else is junk from a code
    if (!d || typeof d.id !== 'string' || !/^[0-9a-f]{8,32}$/i.test(d.id)) continue;
    const name = typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 40) : 'Paired device';
    const pub = typeof d.pub === 'string' && /^[0-9a-f]{64}$/i.test(d.pub) ? d.pub : byId.get(d.id)?.pub;
    byId.set(d.id, { id: d.id, name, addedAt: typeof d.addedAt === 'number' ? d.addedAt : Date.now(), ...(pub ? { pub } : {}) });
  }
  return Array.from(byId.values()).slice(0, 20);
}

/**
 * A paired device learns the group AND the existing device list, so the app can
 * show "this wallet is on these devices" immediately rather than after a sync.
 */
export async function adoptRemoteDevices(incoming: GroupDevice[]): Promise<WalletGroup | null> {
  const group = await getGroup();
  if (!group || !incoming?.length) return group;
  const merged = mergeDevices(group.devices, incoming);
  if (merged.length === group.devices.length) return group;
  const next: WalletGroup = { ...group, devices: merged };
  await persist(next);
  return next;
}

/**
 * The pairing URI an EXISTING device shows. Short-lived; single use on the UI side.
 *
 * DELIBERATELY LEAN. The code is grouped into a QR, so it carries only what is
 * needed to join: group id, group key, expiry. Device NAMES are not encoded —
 * they would blow the payload past what a scannable code can hold, and they
 * already sync inside the sealed blob (`adoptRemoteDevices`), so a paired device
 * learns the list on its first sync. `d` is still PARSED for forward
 * compatibility, just never emitted.
 */
/**
 * The format earlier builds printed into the QR — wallet-group key included.
 *
 * KEPT on purpose. It is the shape existing installs produced, and the history
 * of a wallet is not something to delete for tidiness. What changed is where it
 * is used: the app no longer SHOWS a code like this. Pairing runs the
 * short-lived handshake in pairingSession.ts, which seals the key to the other
 * device instead of printing it on glass.
 *
 * Anyone who screenshotted an old code still holds the key that was inside it,
 * so accepting this format back is a deliberate switch, not a default.
 */
export const LEGACY_PAIRING_ACCEPTED = false;

export function buildPairingPayload(group: WalletGroup, now = Date.now()): string {
  const expires = now + PAIRING_TTL_MS;
  // Only what is needed to join. Public keys and the epoch arrive with the
  // first sealed sync, which keeps this code inside QR capacity.
  return `${PAIR_SCHEME}?g=${group.groupId}&k=${group.key}&e=${expires}`;
}

export function parsePairingPayload(uri: string, now = Date.now()): PairingResult {
  const parsed = parseLegacyPairingPayload(uri, now);
  if (!parsed.ok && parsed.reason === 'scheme') return parsed;
  if (!LEGACY_PAIRING_ACCEPTED) return { ok: false, reason: 'legacy' };
  return parsed;
}

/** The original parser, untouched, for the deliberate opt-in path above. */
export function parseLegacyPairingPayload(uri: string, now = Date.now()): PairingResult {
  const text = uri.trim();
  if (!text.toLowerCase().startsWith(PAIR_SCHEME)) return { ok: false, reason: 'scheme' };
  const query = text.slice(text.indexOf('?') + 1);
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0) params[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
  }
  const { g, k, e, d, n, p } = params;
  if (!g || !k || !e || !/^[0-9a-f]{16,64}$/i.test(g) || !/^[0-9a-f]{32,128}$/i.test(k)) {
    return { ok: false, reason: 'malformed' };
  }
  const expires = Number(e);
  if (!Number.isFinite(expires) || expires < now) return { ok: false, reason: 'expired' };
  let devices: GroupDevice[] = [];
  if (d) {
    try {
      const raw = JSON.parse(d);
      if (Array.isArray(raw)) {
        devices = raw
          .filter((x: any) => x && typeof x.id === 'string')
          .map((x: any) => ({ id: x.id, name: String(x.name ?? 'Paired device').slice(0, 40), addedAt: Number(x.a) || Date.now() }));
      }
    } catch {
      devices = [];
    }
  }
  const epoch = Number(n);
  return {
    ok: true,
    groupId: g,
    key: k,
    devices,
    ...(Number.isFinite(epoch) && epoch >= 0 ? { epoch } : {}),
    ...(/^[0-9a-f]{64}$/i.test(p ?? '') ? { pub: p } : {}),
  };
}

export async function clearGroup(): Promise<void> {
  await persist(null);
}

/** Test seam. */
export function __resetWalletGroupForTests(): void {
  cache = null;
  deviceIdCache = null;
  keyPairCache = null;
}

/** Test seam: pretend to be a specific device id. */
export function __setDeviceIdForTests(id: string): void {
  deviceIdCache = id;
}

/** Test seam: install a group directly. */
export async function __setGroupForTests(group: WalletGroup): Promise<void> {
  cache = group;
  await persist(group);
}

/** Test seam: act as a device whose keypair is known to the test. */
export function __setDeviceKeyPairForTests(secretHex: string, publicHex: string): void {
  keyPairCache = { secret: fromHex(secretHex), public: publicHex };
}
