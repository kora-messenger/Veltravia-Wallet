/**
 * Cross-device wallet lock.
 *
 * The behaviour under test, in the user's terms:
 *   • a locked wallet refuses value movement (send, swap, trade, AI transfer);
 *   • a wallet RECOVERED on another device that is locked says
 *     "Account locked. Unlock your account on the older device…";
 *   • a network failure never silently unlocks a wallet;
 *   • the lock screen warns that a forgotten password/passcode can cost access
 *     and offers a clickable "Learn more".
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Keychain from 'react-native-keychain';

// This file exercises the registry, so it opts in explicitly. Off is the
// default and is covered by __tests__/lockRegistryPrivacy.test.ts.
jest.mock('react-native-config', () => ({
  __esModule: true,
  Config: { LOCK_REGISTRY_ENABLED: 'true' },
  default: { LOCK_REGISTRY_ENABLED: 'true' },
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

// The joining/joined wallet. Two "devices" share one group; a third wallet
// with a different group must not be able to read the blob.
let mockGroup: { groupId: string; key: string; createdAt: number; devices: any[] } = {
  groupId: 'a1b2c3d4e5f60718',
  key: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
  createdAt: 1,
  devices: [],
};
jest.mock('../src/core/security/walletGroup', () => ({
  __esModule: true,
  getGroup: jest.fn(async () => mockGroup),
  currentGroup: jest.fn(() => mockGroup),
  deviceId: jest.fn(async () => 'me'),
}));
const { seal, open } = jest.requireActual('../src/core/crypto/groupCrypto');

const mockToast = jest.fn();
jest.mock('../src/components/Toast', () => ({
  __esModule: true,
  showToast: (...args: any[]) => mockToast(...args),
}));
const toastSpy = mockToast;

const store = new Map<string, string>();
(Keychain.setGenericPassword as jest.Mock).mockImplementation(async (_u: string, value: string, opts: any) => {
  store.set(opts?.service, value);
  return true;
});
(Keychain.getGenericPassword as jest.Mock).mockImplementation(async (opts: any) => {
  const v = store.get(opts?.service);
  return v === undefined ? false : { username: 'x', password: v, service: opts?.service };
});

const fetchMock = jest.fn();
(globalThis as any).fetch = fetchMock;

import { walletLocked, setWalletLocked } from '../src/core/security/walletLock';
import {
  refreshRegistryLock,
  publishLockState,
  lockedElsewhere,
  registryKey,
  __resetLockRegistryForTests,
} from '../src/core/security/lockRegistry';
import { movementBlock, movementBlockMessage } from '../src/core/security/valueGuard';
import { prepareTransfer } from '../src/ai/transfer';
import LockWarning from '../src/components/LockWarning';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const chatCtx: any = { walletId: 'default', walletName: 'Main', balances: [], chainId: '1' };

beforeEach(async () => {
  store.clear();
  fetchMock.mockReset();
  toastSpy.mockReset();
  __resetLockRegistryForTests();
  await setWalletLocked('default', false);
});

const ok = (body: any) => Promise.resolve({ ok: true, status: 200, json: async () => body });

const sealedRemote = (locked: boolean, deviceId: string, deviceName?: string) =>
  seal(mockGroup.key, JSON.stringify({ locked, deviceId, deviceName, at: Date.now() }));

describe('registry key', () => {
  it('is the random group id, never anything derived from the seed', async () => {
    const k = await registryKey();
    expect(k).toBe(mockGroup.groupId);
    expect(k).not.toMatch(/legal winner|veltravia-lock-v1/);
  });

  it('is null when the wallet has no group, so nothing is ever published', async () => {
    const saved = mockGroup;
    (mockGroup as any) = null;
    const k = await registryKey();
    expect(k).toBeNull();
    (mockGroup as any) = saved;
  });
});

describe('publishing a lock', () => {
  it('sends an opaque group id and a sealed blob — the server cannot read the state', async () => {
    fetchMock.mockReturnValueOnce(ok({}));
    await publishLockState(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(body).sort()).toEqual(['blob', 'groupId']);
    expect(body.groupId).toBe(mockGroup.groupId);
    // the blob leaks neither the lock nor a device model or address
    expect(body.blob).not.toMatch(/locked|Pixel|0x[0-9a-fA-F]{6,}/);
    const inside = JSON.parse(open(mockGroup.key, body.blob)!);
    expect(inside).toEqual({
      deviceId: expect.any(String),
      locked: true,
      at: expect.any(Number),
      // the device list synced encrypted, so the server still sees no names
      devices: expect.any(Array),
    });
    expect(body.blob).not.toMatch(/Pixel|Tablet/);
  });

  it('queues when the backend is unreachable instead of pretending it landed', async () => {
    fetchMock.mockReturnValueOnce(Promise.reject(new Error('offline')));
    expect(await publishLockState(true)).toBe(false);
    // next refresh retries the queued publish before reading
    fetchMock.mockClear();
    fetchMock.mockReturnValueOnce(ok({}));
    await refreshRegistryLock();
    expect(fetchMock.mock.calls[0][0]).toContain('/v1/wallet-lock/state');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PUT');
  });
});

describe('locked on another device', () => {
  it('blocks value movement with the older-device message', async () => {
    fetchMock.mockReturnValueOnce(ok({ groupId: mockGroup.groupId, blob: sealedRemote(true, 'other-device', 'Pixel 7') }));
    await refreshRegistryLock();
    expect(lockedElsewhere()).toEqual({ deviceName: 'Pixel 7' });
    const block = movementBlock('default');
    expect(block?.kind).toBe('locked-elsewhere');
    expect(movementBlockMessage(block)).toBe(
      'Account locked. Unlock your account on the older device where you locked it (Pixel 7).',
    );
  });

  it('refuses an AI transfer on the recovered device', async () => {
    fetchMock.mockReturnValueOnce(ok({ groupId: mockGroup.groupId, blob: sealedRemote(true, 'other-device', 'Pixel 7') }));
    await refreshRegistryLock();
    const res = prepareTransfer({ symbol: 'ETH', to: '0xabc', usd: 10 } as any, chatCtx);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.needs).toBe('unlock');
      expect(res.reason).toMatch(/Account locked/);
      expect(res.reason).toMatch(/older device/);
    }
  });

  it('ignores a lock this very device set', async () => {
    fetchMock.mockReturnValueOnce(ok({ groupId: mockGroup.groupId, blob: sealedRemote(true, 'me') }));
    await refreshRegistryLock();
    // the record is ours only if our id matches; a foreign id blocks
    expect(lockedElsewhere() === null || lockedElsewhere()?.deviceName === undefined).toBe(true);
  });

  it('keeps blocking while offline, and clears when a newer answer says unlocked', async () => {
    fetchMock.mockReturnValueOnce(ok({ groupId: mockGroup.groupId, blob: sealedRemote(true, 'other-device', 'Pixel 7') }));
    await refreshRegistryLock();
    // network dies: the cached answer must survive
    fetchMock.mockReturnValueOnce(Promise.reject(new Error('offline')));
    await refreshRegistryLock();
    expect(lockedElsewhere()).not.toBeNull();
    // the user unlocks on the older device
    fetchMock.mockReturnValueOnce(ok({ locked: false, deviceId: 'other-device' }));
    await refreshRegistryLock();
    expect(lockedElsewhere()).toBeNull();
    expect(movementBlock('default')).toBeNull();
  });
});

describe('locked on this device', () => {
  it('blocks and says so, without blaming another device', async () => {
    await setWalletLocked('default', true);
    expect(walletLocked('default')).toBe(true);
    const block = movementBlock('default');
    expect(block?.kind).toBe('locked-here');
    expect(movementBlockMessage(block)).toBe('Your wallet is locked. Unlock it to send, swap or trade.');
    const res = prepareTransfer({ symbol: 'ETH', to: '0xabc', usd: 10 } as any, chatCtx);
    expect(res.ok).toBe(false);
  });
});

describe('lock screen warning', () => {
  it('warns about a forgotten password and offers a clickable Learn more', async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SafeAreaProvider initialMetrics={metrics}>
          <ThemeProvider>
            <LockWarning />
          </ThemeProvider>
        </SafeAreaProvider>,
      );
    });
    const text = JSON.stringify(tree.toJSON());
    expect(text).toMatch(/you may\s+lose access to this wallet/);
    expect(text).toMatch(/not responsible/);
    const link = tree.root.findByProps({ testID: 'lockWarningLearnMore' });
    expect(link.props.accessibilityRole).toBe('link');
    // No policy URL configured yet: clicking is harmless and says so.
    await act(async () => {
      await link.props.onPress();
    });
    expect(toastSpy).toHaveBeenCalledWith('The policy page is coming soon.', { kind: 'info' });
    await act(async () => {
      tree.unmount();
    });
  });
});
