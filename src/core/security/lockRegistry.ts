/**
 * Veltravia Wallet — cross-device wallet lock registry.
 *
 * A wallet locked on one device must not move value on another. The lock is
 * published to our backend under a key derived ONLY from the seed
 * (`sha256("veltravia-lock-v1:" + seed)`, domain separated, 3000 rounds), so a
 * wallet RECOVERED on a brand-new device derives the same key and can see
 * "locked somewhere else" without ever sharing an address.
 *
 * Privacy: this hash, a random device id, a human device label and a
 * timestamp. No address, no balance, no seed, no identity.
 *
 * Offline behaviour, deliberately:
 *   • a publish that fails is queued and retried on the next call;
 *   • an unknown state never blocks by itself;
 *   • the last cached "locked elsewhere" answer KEEPS blocking until a newer
 *     answer refutes it — a flight-mode toggle must not unlock money.
 *
 * The registry is an additional gate on top of the local flag, never a
 * replacement: if the backend is unreachable the local lock still holds.
 */
import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';
import { APP_CONFIG } from '../../config/env';
import { digest } from '../storage/passcode';
import { readSeed } from '../storage/secureStorage';

const SERVICE = 'com.veltravia.wallet.lockregistry';
const KEY_SALT = 'veltravia-lock-v1';
const TIMEOUT_MS = 6000;

export interface RegistryRemote {
  locked: boolean;
  deviceId: string;
  deviceName?: string;
  at?: number;
}

interface RegistryState {
  key: string | null;
  deviceId: string;
  deviceName: string;
  remote: RegistryRemote | null;
  pending: boolean;
}

const randomId = () =>
  Array.from({ length: 12 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');

let state: RegistryState = { key: null, deviceId: '', deviceName: '', remote: null, pending: false };
let loaded = false;

function deviceName(): string {
  const model = (Platform.constants as { Model?: string; Brand?: string } | undefined)?.Model;
  return model ? `${model}`.trim() : Platform.OS === 'ios' ? 'iPhone' : 'Android device';
}

async function read(): Promise<RegistryState> {
  if (loaded) return state;
  loaded = true;
  try {
    const res = await Keychain.getGenericPassword({ service: SERVICE });
    const parsed = res === false ? null : JSON.parse(res.password);
    if (parsed && typeof parsed === 'object') {
      state = {
        key: typeof parsed.key === 'string' ? parsed.key : null,
        deviceId: typeof parsed.deviceId === 'string' && parsed.deviceId ? parsed.deviceId : randomId(),
        deviceName: typeof parsed.deviceName === 'string' && parsed.deviceName ? parsed.deviceName : deviceName(),
        remote: parsed.remote && typeof parsed.remote === 'object' ? parsed.remote : null,
        pending: parsed.pending === true,
      };
    }
  } catch {
    /* fall through to a fresh identity */
  }
  if (!state.deviceId) state.deviceId = randomId();
  if (!state.deviceName) state.deviceName = deviceName();
  return state;
}

async function write(next: Partial<RegistryState>): Promise<void> {
  state = { ...(await read()), ...next };
  try {
    await Keychain.setGenericPassword('registry', JSON.stringify(state), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    /* keep the in-memory state; a later write retries */
  }
}

/**
 * The registry key for THIS wallet. Derived from the seed so that the same
 * wallet on another device lands on the same record. Null when no seed.
 */
export async function registryKey(): Promise<string | null> {
  const st = await read();
  if (st.key) return st.key;
  let seed: string | null = null;
  try {
    seed = await readSeed();
  } catch {
    seed = null;
  }
  if (!seed) return null;
  const key = digest(seed, KEY_SALT);
  await write({ key });
  return key;
}

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Publish this device's lock state for the wallet. Best effort, queued on failure. */
export async function publishLockState(locked: boolean): Promise<boolean> {
  const st = await read();
  const key = st.key ?? (await registryKey());
  if (!key) return false;
  try {
    const res = await timedFetch(`${APP_CONFIG.API_BASE_URL}/v1/wallet-lock/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Veltravia-Env': APP_CONFIG.env },
      body: JSON.stringify({
        key,
        locked,
        deviceId: st.deviceId,
        deviceName: st.deviceName,
        at: Date.now(),
      }),
    });
    if (!res.ok) throw new Error(`publish ${res.status}`);
    const remote: RegistryRemote = { locked, deviceId: st.deviceId, deviceName: st.deviceName, at: Date.now() };
    await write({ remote, pending: false });
    return true;
  } catch {
    await write({ pending: true });
    return false;
  }
}

/**
 * Re-read the canonical state from the backend and cache it. Returns the
 * cached record on any failure (never throws), so guards stay honest.
 */
export async function refreshRegistryLock(): Promise<RegistryRemote | null> {
  const st = await read();
  const key = st.key ?? (await registryKey());
  if (!key) return st.remote;

  // A queued publish first: our own newer state must not be overwritten by a
  // stale read.
  if (st.pending) {
    const ok = await publishLockState(st.remote?.locked === true);
    if (!ok) return st.remote;
  }

  try {
    const res = await timedFetch(
      `${APP_CONFIG.API_BASE_URL}/v1/wallet-lock/state?key=${encodeURIComponent(key)}`,
      { headers: { 'X-Veltravia-Env': APP_CONFIG.env } },
    );
    if (res.status === 404) {
      await write({ remote: null });
      return null;
    }
    if (!res.ok) throw new Error(`read ${res.status}`);
    const body = (await res.json()) as Partial<RegistryRemote> | null;
    const remote: RegistryRemote | null =
      body && typeof body.locked === 'boolean'
        ? {
            locked: body.locked,
            deviceId: typeof body.deviceId === 'string' ? body.deviceId : '',
            deviceName: typeof body.deviceName === 'string' ? body.deviceName : undefined,
            at: typeof body.at === 'number' ? body.at : undefined,
          }
        : null;
    await write({ remote });
    return remote;
  } catch {
    return st.remote;
  }
}

/**
 * Synchronous guard for the money paths.
 * Non-null => this wallet is locked on ANOTHER device and must not move value
 * here. Null => nothing known (or the lock is this device's own, which the
 * local flag already covers).
 */
export function lockedElsewhere(): { deviceName?: string } | null {
  const remote = state.remote;
  if (!remote || !remote.locked) return null;
  if (remote.deviceId && remote.deviceId === state.deviceId) return null; // our own lock
  return { deviceName: remote.deviceName };
}

/** Forget the cached remote answer (used on sign-out / wallet removal). */
export async function resetLockRegistry(): Promise<void> {
  await write({ key: null, remote: null, pending: false });
}

/** Tests only. */
export function __resetLockRegistryForTests(): void {
  state = { key: null, deviceId: '', deviceName: '', remote: null, pending: false };
  loaded = false;
}
