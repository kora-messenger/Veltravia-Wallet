/**
 * Wallet groups: pairing without putting the seed on the wire.
 *
 * The design rule these tests protect: the recovery phrase is a root credential
 * that only ever acts locally. A wallet's device group is a random id and a
 * random key, shared only by an explicit, short-lived pairing code shown on an
 * EXISTING device. Plus the sealed box that keeps lock state readable only by
 * paired devices.
 */
import * as Keychain from 'react-native-keychain';
import { seal, open } from '../src/core/crypto/groupCrypto';
import { hmac, sha256, fromAscii, toHex, timingSafeEqual } from '../src/core/crypto/hash';

jest.mock('react-native-config', () => ({
  __esModule: true,
  Config: {},
  default: {},
}));

const store = new Map<string, string>();
(Keychain.setGenericPassword as jest.Mock).mockImplementation(async (_u: string, value: string, opts: any) => {
  store.set(opts?.service, value);
  return true;
});
(Keychain.getGenericPassword as jest.Mock).mockImplementation(async (opts: any) => {
  const v = store.get(opts?.service);
  return v === undefined ? false : { username: 'x', password: v, service: opts?.service };
});
(Keychain.resetGenericPassword as jest.Mock).mockImplementation(async (opts: any) => {
  store.delete(opts?.service);
  return true;
});

import {
  adoptRemoteDevices,
  mergeDevices,
  buildPairingPayload,
  clearGroup,
  currentGroup,
  deviceId,
  ensureGroup,
  getGroup,
  joinGroup,
  parsePairingPayload,
  revokeDevice,
  __resetWalletGroupForTests,
} from '../src/core/security/walletGroup';

function mockStoreClear() {
  store.clear();
}

beforeEach(async () => {
  store.clear();
  __resetWalletGroupForTests();
  await clearGroup();
  __resetWalletGroupForTests();
});

describe('crypto primitives', () => {
  it('hashes and MACs to stable, known-shape values', () => {
    expect(toHex(sha256(fromAscii('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    // RFC 4231 test case 2
    expect(toHex(hmac(fromAscii('Jefe'), fromAscii('what do ya want for nothing?')))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
    expect(timingSafeEqual(fromAscii('abc'), fromAscii('abc'))).toBe(true);
    expect(timingSafeEqual(fromAscii('abc'), fromAscii('abd'))).toBe(false);
  });
});

describe('sealed box', () => {
  const key = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

  it('round-trips and is non-deterministic (fresh nonce each time)', () => {
    const a = seal(key, '{"locked":true}');
    const b = seal(key, '{"locked":true}');
    expect(a).not.toBe(b);
    expect(open(key, a)).toBe('{"locked":true}');
    expect(open(key, b)).toBe('{"locked":true}');
  });

  it('rejects a wrong key and a tampered ciphertext', () => {
    const box = seal(key, 'secret');
    const other = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
    expect(open(other, box)).toBeNull();
    const flipped = box.slice(0, 40) + (box[40] === 'a' ? 'b' : 'a') + box.slice(41);
    expect(open(key, flipped)).toBeNull();
  });
});

describe('group creation', () => {
  it('creates a random group once and registers this device', async () => {
    const g1 = await ensureGroup('Pixel');
    expect(g1.groupId).toMatch(/^[0-9a-f]{32}$/);
    expect(g1.key).toMatch(/^[0-9a-f]{64}$/);
    expect(g1.devices).toHaveLength(1);
    const g2 = await ensureGroup('Pixel');
    expect(g2.groupId).toBe(g1.groupId);
    expect(currentGroup()?.groupId).toBe(g1.groupId);
  });

  it('derives nothing from anything the user can retype', async () => {
    const g1 = await ensureGroup();
    await clearGroup();
    __resetWalletGroupForTests();
    const g2 = await ensureGroup();
    expect(g2.groupId).not.toBe(g1.groupId);
    expect(g2.key).not.toBe(g1.key);
  });

  it('keeps a stable random device id, not a hardware identifier', async () => {
    const a = await deviceId();
    const b = await deviceId();
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('pairing', () => {
  it('lets a second device join with the code an existing device shows', async () => {
    const host = await ensureGroup('Pixel');
    const uri = buildPairingPayload(host);
    const parsed = parsePairingPayload(uri);
    expect(parsed.ok).toBe(true);

    // the joining device starts empty, then adopts the group
    __resetWalletGroupForTests();
    store.clear();
    const joined = await joinGroup(parsed, 'Tablet');
    expect(joined?.groupId).toBe(host.groupId);
    expect(joined?.key).toBe(host.key);
    expect((await getGroup())?.key).toBe(host.key);
  });

  it('refuses an expired code', async () => {
    const host = await ensureGroup();
    const uri = buildPairingPayload(host, Date.now() - 10 * 60 * 1000);
    expect(parsePairingPayload(uri)).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses a foreign scheme or a malformed payload', () => {
    expect(parsePairingPayload('https://evil.example/join?g=a1b2c3d4e5f60718&k=' + 'a'.repeat(64)).ok).toBe(false);
    expect(parsePairingPayload('veltravia-pair://join?g=zz&k=zz&e=9')).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });
});

describe('pairing code shape', () => {
  it('stays scannable: no device names in the QR, list syncs separately', async () => {
    await ensureGroup('Pixel');
    await adoptRemoteDevices([{ id: 'abc12345', name: 'Tablet', addedAt: 5 }]);
    const uri = buildPairingPayload((await getGroup())!);
    // A QR has a hard size ceiling; names live in the sealed blob instead.
    expect(uri).not.toContain('Pixel');
    expect(uri.length).toBeLessThan(160);

    const parsed = parsePairingPayload(uri);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.devices).toEqual([]);

    __resetWalletGroupForTests();
    mockStoreClear();
    const joined = await joinGroup(parsed, 'Laptop');
    expect(joined?.devices.map((d) => d.name)).toEqual(['Laptop']);

    // The host's list arrives on the next sync, inside the sealed box.
    const afterSync = await adoptRemoteDevices([
      { id: joined!.devices[0].id, name: 'Laptop', addedAt: 1 },
      { id: 'abc12345', name: 'Tablet', addedAt: 5 },
    ]);
    expect(afterSync?.devices.map((d) => d.name).sort()).toEqual(['Laptop', 'Tablet']);
  });

  it('merges without duplicating a device seen twice, and caps the list', () => {
    const a = { id: 'aaaaaaaa', name: 'Phone', addedAt: 1 };
    const b = { id: 'bbbbbbbb', name: 'Old name', addedAt: 2 };
    const merged = mergeDevices([a, b], [{ ...b, name: 'New name' }, a]);
    expect(merged).toHaveLength(2);
    expect(merged.find((d) => d.id === b.id)?.name).toBe('New name');

    const many = Array.from({ length: 30 }, (_, i) => ({ id: i.toString(16).padStart(8, '0'), name: `D${i}`, addedAt: i }));
    expect(mergeDevices(many, []).length).toBe(20);
  });

  it('ignores junk device entries rather than trusting the code', () => {
    expect(mergeDevices([], [{ id: 'x' } as any, { name: 'no id' } as any])).toEqual([]);
  });
});

describe('revoking a device', () => {
  it('rotates the group key so a removed phone cannot read future state', async () => {
    const host = await ensureGroup();
    const uri = buildPairingPayload(host);
    const joined = await joinGroup(parsePairingPayload(uri), 'Old phone');
    const oldKey = joined!.key;

    const rotated = await revokeDevice('other-device');
    expect(rotated?.key).not.toBe(oldKey);

    // state published after the revoke is unreadable with the old key
    const fresh = seal(rotated!.key, '{"locked":true}');
    expect(open(oldKey, fresh)).toBeNull();
    expect(open(rotated!.key, fresh)).toBe('{"locked":true}');
  });
});
