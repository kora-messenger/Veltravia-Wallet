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
import { fromAscii, randomBytes, sha256, toHex } from '../crypto/hash';
import { digest } from '../storage/passcode';
import { readSeed } from '../storage/secureStorage';

const SERVICE = 'com.veltravia.wallet.walletgroup';
const DEVICE_SERVICE = 'com.veltravia.wallet.deviceid';
const PAIR_SCHEME = 'veltravia-pair://join';
export const PAIRING_TTL_MS = 5 * 60 * 1000;

export interface GroupDevice {
  id: string;
  name: string;
  addedAt: number;
}

export interface WalletGroup {
  groupId: string;
  /** Group key, hex. Seed-derived, or rotated when a PAIRED device is removed. */
  key: string;
  createdAt: number;
  devices: GroupDevice[];
  /** Where the identity came from — decides whether removal can revoke access. */
  source?: 'seed' | 'pairing';
}

export type PairingResult =
  | { ok: true; groupId: string; key: string; devices: GroupDevice[] }
  | { ok: false; reason: 'malformed' | 'expired' | 'scheme' };

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

export async function getGroup(): Promise<WalletGroup | null> {
  if (cache) return cache;
  const stored = await readStored();
  const seed = await readSeedSafely();
  if (seed) {
    const { groupId, key } = deriveSeedGroup(seed);
    const own = await deviceId();
    // Keep whatever device names this install has learned, if it is the same wallet.
    const devices =
      stored && stored.groupId === groupId && stored.devices.length
        ? stored.devices
        : [{ id: own, name: 'This device', addedAt: Date.now() }];
    cache = { groupId, key, createdAt: stored?.createdAt ?? Date.now(), devices, source: 'seed' };
    if (!stored || stored.groupId !== groupId) await persist(cache);
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
    if (!existing.devices.some((d) => d.id === own)) {
      const next: WalletGroup = {
        ...existing,
        devices: [...existing.devices, { id: own, name: deviceName, addedAt: Date.now() }],
      };
      await persist(next);
      return next;
    }
    return existing;
  }
  const id = await deviceId();
  const group: WalletGroup = {
    groupId: hex(16),
    key: hex(32),
    createdAt: Date.now(),
    devices: [{ id, name: deviceName, addedAt: Date.now() }],
  };
  await persist(group);
  return group;
}

/** Adopt a group from a scanned pairing code (the joining device calls this). */
export async function joinGroup(payload: PairingResult, deviceName = 'This device'): Promise<WalletGroup | null> {
  if (!payload.ok) return null;
  const id = await deviceId();
  const group: WalletGroup = {
    groupId: payload.groupId,
    key: payload.key,
    createdAt: Date.now(),
    devices: mergeDevices([{ id, name: deviceName, addedAt: Date.now() }], payload.devices ?? []),
    source: 'pairing',
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
  const next: WalletGroup = {
    ...group,
    // A seed-derived key cannot be rotated without changing the phrase, so
    // removal from a seed group is a local tidy-up, not a revocation. Owners of
    // the phrase can still read state; the UI says so.
    key: group.source === 'seed' ? group.key : hex(32),
    devices: group.devices.filter((d) => d.id !== id),
  };
  await persist(next);
  return next;
}

/** Union of two device lists, by id. Newest name wins. */
export function mergeDevices(current: GroupDevice[], incoming: GroupDevice[]): GroupDevice[] {
  const byId = new Map<string, GroupDevice>();
  for (const d of [...current, ...incoming]) {
    // ids are hex from randomBytes(8); anything else is junk from a code
    if (!d || typeof d.id !== 'string' || !/^[0-9a-f]{8,32}$/i.test(d.id)) continue;
    const name = typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 40) : 'Paired device';
    byId.set(d.id, { id: d.id, name, addedAt: typeof d.addedAt === 'number' ? d.addedAt : Date.now() });
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
export function buildPairingPayload(group: WalletGroup, now = Date.now()): string {
  const expires = now + PAIRING_TTL_MS;
  return `${PAIR_SCHEME}?g=${group.groupId}&k=${group.key}&e=${expires}`;
}

export function parsePairingPayload(uri: string, now = Date.now()): PairingResult {
  const text = uri.trim();
  if (!text.toLowerCase().startsWith(PAIR_SCHEME)) return { ok: false, reason: 'scheme' };
  const query = text.slice(text.indexOf('?') + 1);
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0) params[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
  }
  const { g, k, e, d } = params;
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
  return { ok: true, groupId: g, key: k, devices };
}

export async function clearGroup(): Promise<void> {
  await persist(null);
}

/** Test seam. */
export function __resetWalletGroupForTests(): void {
  cache = null;
  deviceIdCache = null;
}
