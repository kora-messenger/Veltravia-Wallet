const mockFetchState = jest.fn();
jest.mock('@react-native-community/netinfo', () => ({ fetch: () => mockFetchState() }));

import { checkOnline, offlineMessage } from '../src/services/connectivity';

beforeEach(() => mockFetchState.mockReset());

describe('checkOnline', () => {
  it('online when connected and reachable', async () => {
    mockFetchState.mockResolvedValue({ isConnected: true, isInternetReachable: true });
    await expect(checkOnline()).resolves.toEqual({ online: true });
  });

  it('offline with no connection at all', async () => {
    mockFetchState.mockResolvedValue({ isConnected: false, isInternetReachable: null });
    await expect(checkOnline()).resolves.toEqual({ online: false, reason: 'offline' });
  });

  it('offline when connected to a dead network (captive portal)', async () => {
    mockFetchState.mockResolvedValue({ isConnected: true, isInternetReachable: false });
    await expect(checkOnline()).resolves.toEqual({ online: false, reason: 'unreachable' });
  });

  it('does not block the user when the state is unknown', async () => {
    mockFetchState.mockResolvedValue({ isConnected: true, isInternetReachable: null });
    await expect(checkOnline()).resolves.toEqual({ online: true });
  });

  it('does not block on a hung native call', async () => {
    mockFetchState.mockImplementation(() => new Promise(() => {}));
    await expect(checkOnline(20)).resolves.toEqual({ online: true });
  });

  it('wording tells the user what to do', () => {
    expect(offlineMessage('offline')).toMatch(/offline/i);
    expect(offlineMessage('unreachable')).toMatch(/No internet/i);
  });
});
