/**
 * Removing a device must be a real revocation, not a tidy-up.
 *
 * The wallet's key is rotated on removal and handed to every REMAINING device
 * through a per-device envelope (X25519). The removed device still holds the
 * old key, so it can read the announcement and can see the envelopes — it just
 * has none, and cannot compute one. That is what "stays truly removed" means
 * here: no re-derivation from the phrase, no envelope, no future state.
 */
import nacl from 'tweetnacl';

jest.mock('react-native-keychain', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly', WHEN_UNLOCKED: 'b' },
    setGenericPassword: jest.fn(async (_u: string, value: string, opts: any) => {
      store.set(opts?.service, value);
      return true;
    }),
    getGenericPassword: jest.fn(async (opts: any) => {
      const v = store.get(opts?.service);
      return v === undefined ? false : { username: 'x', password: v, service: opts?.service };
    }),
    resetGenericPassword: jest.fn(async () => true),
    __store: store,
  };
});
jest.mock('../src/core/storage/secureStorage', () => ({
  __esModule: true,
  readSeed: jest.fn(async () => 'legal winner thank year wave sausage worth useful legal winner thank yellow'),
}));

import * as Keychain from 'react-native-keychain';
import { fromHex, toHex } from '../src/core/crypto/hash';
import { seal } from '../src/core/crypto/groupCrypto';
import {
  __resetWalletGroupForTests,
  __setDeviceKeyPairForTests,
  __setGroupForTests,
  __setDeviceIdForTests,
  applyRotation,
  deviceId,
  deviceKeyPair,
  ensureGroup,
  getGroup,
  groupRemoved,
  joinGroup,
  markRemoved,
  revokeDevice,
} from '../src/core/security/walletGroup';

const store = (Keychain as any).__store as Map<string, string>;

/** Act as a different phone: fresh keystore, same recovery phrase. */
async function becomeDevice(name: string) {
  store.clear();
  __resetWalletGroupForTests();
  return name;
}

describe('removing a device really revokes it', () => {
  it('rotates the key and addresses the new one to everyone except the removed device', async () => {
    await becomeDevice('A');
    const a = await ensureGroup('Phone A');
    const oldKey = a.key;

    // Two more devices, with keypairs the test controls.
    const bPair = nacl.box.keyPair();
    const cPair = nacl.box.keyPair();
    const bPub = toHex(bPair.publicKey);
    const cPub = toHex(cPair.publicKey);
    await __setGroupForTests({
      ...a,
      devices: [
        ...a.devices,
        { id: 'bbbbbbbb', name: 'Phone B', addedAt: 2, pub: bPub },
        { id: 'cccccccc', name: 'Phone C', addedAt: 3, pub: cPub },
      ],
    });

    const rotation = await revokeDevice('bbbbbbbb');
    expect(rotation).toBeTruthy();
    expect(rotation!.key).not.toBe(oldKey);
    expect(rotation!.epoch).toBe(1);

    const env = rotation!.pendingRotation!;
    expect(Object.keys(env.envelopes)).toEqual(['cccccccc']); // C only, never B
    expect(env.envelopes.bbbbbbbb).toBeUndefined();

    // C can unwrap the new key; B has nothing to unwrap.
    const payload = fromHex(env.envelopes.cccccccc);
    const nonce = payload.slice(0, nacl.box.nonceLength);
    const boxed = payload.slice(nacl.box.nonceLength);
    const shared = nacl.box.before(fromHex(env.by), cPair.secretKey);
    const opened = nacl.box.open.after(boxed, nonce, shared);
    expect(opened).not.toBeNull();
    expect(String.fromCharCode(...(opened as Uint8Array))).toBe(rotation!.key);
  });

  it('a removed device sees the announcement, finds no envelope, and is marked removed', async () => {
    await becomeDevice('A');
    await ensureGroup('Phone A');
    const host = (await getGroup())!;

    // B joins with the current key.
    const bPair = nacl.box.keyPair();
    await becomeDevice('B');
    __setDeviceIdForTests('bbbbbbbb');
    const bGroup = await joinGroup(
      { ok: true, groupId: host.groupId, key: host.key, devices: [{ id: 'aaaaaaaa', name: 'Phone A', addedAt: 1, pub: host.pub }] },
      'Phone B',
    );
    __setDeviceKeyPairForTests(toHex(bPair.secretKey), toHex(bPair.publicKey));
    expect(bGroup).toBeTruthy();

    // Host revokes B and announces a rotation under the old key.
    await becomeDevice('A');
    await joinGroup(
      { ok: true, groupId: host.groupId, key: host.key, devices: [{ id: 'bbbbbbbb', name: 'Phone B', addedAt: 2, pub: toHex(bPair.publicKey) }] },
      'Phone A',
    );
    const rotated = await revokeDevice('bbbbbbbb');
    const announcement = seal(host.key, JSON.stringify({
      epoch: rotated!.pendingRotation!.epoch,
      envelopes: rotated!.pendingRotation!.envelopes,
      by: rotated!.pendingRotation!.by,
    }));

    // Back to B: it can read the announcement (it holds the old key)…
    await becomeDevice('B');
    __setDeviceIdForTests('bbbbbbbb');
    await joinGroup({ ok: true, groupId: host.groupId, key: host.key, devices: [] }, 'Phone B');
    __setDeviceKeyPairForTests(toHex(bPair.secretKey), toHex(bPair.publicKey));
    const parsedAnnouncement = JSON.parse(
      // B opens it with the only key it has
      require('../src/core/crypto/groupCrypto').open(host.key, announcement),
    );
    expect(parsedAnnouncement.epoch).toBe(1);
    expect(parsedAnnouncement.envelopes.bbbbbbbb).toBeUndefined();

    // …but adopting it fails: no envelope, so the new epoch stays unreachable.
    expect(await applyRotation(parsedAnnouncement)).toBe(false);
    expect((await getGroup())!.epoch).toBe(0);
    expect((await getGroup())!.key).toBe(host.key);

    // And the next state, sealed with the new key, is simply unreadable here.
    const nextBlob = seal(rotated!.key, JSON.stringify({ locked: false, deviceId: 'aaaaaaaa', at: 1 }));
    expect(require('../src/core/crypto/groupCrypto').open((await getGroup())!.key, nextBlob)).toBeNull();

    // The registry marks this device removed rather than silently reading nothing.
    await markRemoved();
    expect(groupRemoved()).toBe(true);
  });

  it('a remaining device adopts the rotation and reads the new state', async () => {
    await becomeDevice('A');
    await ensureGroup('Phone A');
    const host = (await getGroup())!;

    // C is in the host's device list; the host revokes B, which C never was.
    const cPair = nacl.box.keyPair();
    const cPub = toHex(cPair.publicKey);
    await __setGroupForTests({
      ...host,
      devices: [
        ...host.devices,
        { id: 'bbbbbbbb', name: 'Phone B', addedAt: 2 },
        { id: 'cccccccc', name: 'Phone C', addedAt: 3, pub: cPub },
      ],
    });
    const rotated = await revokeDevice('bbbbbbbb');

    await becomeDevice('C');
    __setDeviceIdForTests('cccccccc');
    await joinGroup({ ok: true, groupId: host.groupId, key: host.key, devices: [] }, 'Phone C');
    __setDeviceKeyPairForTests(toHex(cPair.secretKey), toHex(cPair.publicKey));

    expect(await applyRotation({
      epoch: rotated!.pendingRotation!.epoch,
      envelopes: rotated!.pendingRotation!.envelopes,
      by: rotated!.pendingRotation!.by,
    })).toBe(true);

    const c = (await getGroup())!;
    expect(c.epoch).toBe(1);
    expect(c.key).toBe(rotated!.key);
    expect(groupRemoved()).toBe(false);

    // The post-rotation state is readable on C.
    const nextBlob = seal(rotated!.key, JSON.stringify({ locked: true, deviceId: 'aaaaaaaa', at: 1 }));
    expect(JSON.parse(require('../src/core/crypto/groupCrypto').open(c.key, nextBlob)!)).toMatchObject({ locked: true });
  });

  it('never strands the device doing the removing', async () => {
    await becomeDevice('A');
    const group = await ensureGroup('Phone A');
    const own = await deviceId();
    const after = await revokeDevice(own);
    expect(after!.key).toBe(group.key); // no rotation, no self-revocation
    expect(await deviceKeyPair()).toBeTruthy();
  });
});
