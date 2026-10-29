/**
 * An unlinked device must stop being a wallet.
 *
 * The owner removes a phone from Paired devices. That phone then reads state it
 * cannot decrypt, concludes it is out, deletes its own wallet and lands on the
 * welcome screen — not "keeps working with a local lock".
 */
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
    resetGenericPassword: jest.fn(async (opts: any) => {
      store.delete(opts?.service);
      return true;
    }),
    __store: store,
  };
});

import * as Keychain from 'react-native-keychain';

const store = (Keychain as any).__store as Map<string, string>;

jest.mock('../src/core/storage/secureStorage', () => ({
  __esModule: true,
  wipeWallet: jest.fn(async () => {
    const s = (require('react-native-keychain') as any).__store as Map<string, string>;
    s.delete('com.veltravia.wallet.seed');
    s.delete('com.veltravia.wallet.pinhash');
  }),
}));

import {
  __setRemovalNoticeForTests,
  handleDeviceRemoved,
  takeRemovalNotice,
  wipeRemovedDevice,
} from '../src/core/security/deviceRemoval';
import { onDeviceRemoved, __resetDeviceRemovalHandlersForTests } from '../src/core/security/removalEvents';

describe('an unlinked device returns to a clean install', () => {
  beforeEach(() => {
    store.clear();
    __resetDeviceRemovalHandlersForTests();
    __setRemovalNoticeForTests(false);
  });

  it('deletes the phrase, accounts, lock state, group and device identity', async () => {
    store.set('com.veltravia.wallet.seed', 'legal winner thank year');
    store.set('com.veltravia.wallet.accounts', JSON.stringify([{ id: 'wallet-1' }]));
    store.set('com.veltravia.wallet.securitypassword.wallet-1', 'salt:digest');
    store.set('com.veltravia.wallet.walletlock', JSON.stringify({ 'wallet-1': true }));
    store.set('com.veltravia.wallet.walletgroup', '{"groupId":"abc"}');
    store.set('com.veltravia.wallet.devicekey', '{"secret":"00","public":"11"}');
    store.set('com.veltravia.wallet.lockregistry', '{"key":"abc"}');

    await wipeRemovedDevice();

    expect(store.has('com.veltravia.wallet.seed')).toBe(false);
    expect(store.has('com.veltravia.wallet.accounts')).toBe(false);
    // account-scoped services are cleared using ids read before the list went
    expect(store.has('com.veltravia.wallet.securitypassword.wallet-1')).toBe(false);
    expect(store.has('com.veltravia.wallet.walletlock')).toBe(false);
    expect(store.has('com.veltravia.wallet.walletgroup')).toBe(false);
    expect(store.has('com.veltravia.wallet.devicekey')).toBe(false);
    expect(store.has('com.veltravia.wallet.lockregistry')).toBe(false);
  });

  it('notifies the app root so it can navigate back to welcome', async () => {
    const handler = jest.fn();
    onDeviceRemoved(handler);

    await handleDeviceRemoved();

    expect(handler).toHaveBeenCalledTimes(1);
    // The welcome screen reads this once and shows "This device was unlinked".
    expect(takeRemovalNotice()).toBe(true);
    expect(takeRemovalNotice()).toBe(false); // shown once, then forgotten
  });

  it('is safe to run twice', async () => {
    store.set('com.veltravia.wallet.seed', 'legal winner thank year');
    await wipeRemovedDevice();
    await expect(wipeRemovedDevice()).resolves.toBeUndefined();
    expect(store.has('com.veltravia.wallet.seed')).toBe(false);
  });
});
