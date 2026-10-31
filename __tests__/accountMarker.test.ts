/** Storing a seed is what creates the account; wiping it is what ends one. */

const store: Record<string, string> = {};
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlocked' },
  ACCESS_CONTROL: { BIOMETRY_CURRENT_SET: 'bio' },
  setGenericPassword: jest.fn(async (user: string, pass: string, o: any) => {
    store[o.service] = pass;
    return { service: o.service, storage: 'mock' };
  }),
  getGenericPassword: jest.fn(async (o: any) =>
    store[o.service] !== undefined ? { username: 'x', password: store[o.service], service: o.service } : false),
  resetGenericPassword: jest.fn(async (o: any) => {
    delete store[o.service];
    return true;
  }),
}));

import { storeSeed, wipeWallet, readSettings } from '../src/core/storage/secureStorage';

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe('account marker', () => {
  it('storing the seed records the account', async () => {
    await storeSeed('twelve words');
    await expect(readSettings()).resolves.toMatchObject({ accountState: 'yes' });
  });

  it('wiping the wallet records that there is no account', async () => {
    await storeSeed('twelve words');
    await wipeWallet();
    await expect(readSettings()).resolves.toMatchObject({ accountState: 'no' });
  });
});
