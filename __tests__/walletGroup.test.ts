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
  clearGroup,
  currentGroup,
  deviceId,
  ensureGroup,
  getGroup,
  LEGACY_PAIRING_ACCEPTED,
  adoptPairingMaterial,
  buildPairingPayload,
  joinGroup,
  parseLegacyPairingPayload,
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
  it('adopts material that arrived from a completed handshake', async () => {
    const host = await ensureGroup('Pixel');
    // The key is delivered by pairingSession after the safety number matches;
    // this is the adoption step only.
    __resetWalletGroupForTests();
    store.clear();
    const joined = await adoptPairingMaterial({ groupId: host.groupId, key: host.key, epoch: 0 }, 'Tablet');
    expect(joined?.groupId).toBe(host.groupId);
    expect(joined?.key).toBe(host.key);
    expect((await getGroup())?.key).toBe(host.key);
  });

  it('refuses material it did not verify', async () => {
    expect(await adoptPairingMaterial({ groupId: 'zz', key: 'ab'.repeat(32), epoch: 0 })).toBeNull();
    expect(await adoptPairingMaterial({ groupId: 'a1b2c3d4e5f60718', key: 'nope', epoch: 0 })).toBeNull();
  });

  it('still recognises the old key-bearing code, but will not act on it by default', async () => {
    // The format is kept: it is what earlier builds produced, and the parser
    // still reads it. What the app refuses is trusting it automatically.
    const host = await ensureGroup();
    const uri = buildPairingPayload(host);
    expect(parseLegacyPairingPayload(uri).ok).toBe(true);
    expect(parsePairingPayload(uri)).toEqual({ ok: false, reason: 'legacy' });
    expect(LEGACY_PAIRING_ACCEPTED).toBe(false);
    // Plain non-pairing text is not a "legacy code", it is just not ours.
    expect(parsePairingPayload('https://example.com').ok).toBe(false);
  });
});

describe('device list hygiene', () => {
  it('merges without duplicating a device seen twice, and caps the list', () => {
    const a = { id: 'aaaaaaaa', name: 'Phone', addedAt: 1 };
    const b = { id: 'bbbbbbbb', name: 'Old name', addedAt: 2 };
    const merged = mergeDevices([a, b], [{ ...b, name: 'New name' }, a]);
    expect(merged).toHaveLength(2);
    expect(merged.find((d) => d.id === b.id)?.name).toBe('New name');

    const many = Array.from({ length: 30 }, (_, i) => ({ id: i.toString(16).padStart(8, '0'), name: `D${i}`, addedAt: i }));
    expect(mergeDevices(many, []).length).toBe(20);
  });

  it('ignores junk device entries rather than trusting what arrives', () => {
    expect(mergeDevices([], [{ id: 'x' } as any, { name: 'no id' } as any])).toEqual([]);
  });

  it('learns the host device list from the sealed sync, not from a code', async () => {
    await ensureGroup('Pixel');
    await adoptRemoteDevices([{ id: 'abc12345', name: 'Tablet', addedAt: 5 }]);
    const afterSync = await adoptRemoteDevices([
      { id: 'abc12345', name: 'Tablet', addedAt: 5 },
      { id: 'def67890', name: 'Laptop', addedAt: 6 },
    ]);
    expect(afterSync?.devices.map((d) => d.name).sort()).toEqual(['Laptop', 'Pixel', 'Tablet']);
  });
});

describe('revoking a device', () => {
  it('rotates the group key so a removed phone cannot read future state', async () => {
    const host = await ensureGroup();
    const joined = await adoptPairingMaterial({ groupId: host.groupId, key: host.key, epoch: 0 }, 'Old phone');
    const oldKey = joined!.key;

    const rotated = await revokeDevice('other-device');
    expect(rotated?.key).not.toBe(oldKey);

    // state published after the revoke is unreadable with the old key
    const fresh = seal(rotated!.key, '{"locked":true}');
    expect(open(oldKey, fresh)).toBeNull();
    expect(open(rotated!.key, fresh)).toBe('{"locked":true}');
  });
});
