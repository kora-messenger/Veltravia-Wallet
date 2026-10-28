jest.mock('../src/core/storage/secureStorage', () => ({
  readSettings: jest.fn(async () => ({})),
  writeSettings: jest.fn(async () => ({})),
}));

import {
  ensurePerpsSessionLoad, perpsSessionLoaded, resetPerpsAccounts, setBalanceLookup,
  SIMULATED_LOOKUP_MS, MIN_SKELETON_MS,
} from '../src/services/perpsAccount';

describe('perps balance loading (Trust timing)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetPerpsAccounts();
  });
  afterEach(() => jest.useRealTimers());

  it('mirrors Trust: stays loading for ~4.3s on a cold open, then resolves', async () => {
    expect(SIMULATED_LOOKUP_MS).toBeGreaterThanOrEqual(4000);
    // default lookup (restore the simulated round trip)
    setBalanceLookup(() => new Promise<void>((res) => { setTimeout(res, SIMULATED_LOOKUP_MS); }));
    const p = ensurePerpsSessionLoad();
    await jest.advanceTimersByTimeAsync(SIMULATED_LOOKUP_MS - 500);
    expect(perpsSessionLoaded()).toBe(false); // still skeleton at ~3.8s
    await jest.advanceTimersByTimeAsync(600);
    await p;
    expect(perpsSessionLoaded()).toBe(true); // real balance after ~4.3s
  });

  it('a fast answer still holds the skeleton for the minimum, so it never flashes', async () => {
    setBalanceLookup(async () => {}); // instant backend
    const p = ensurePerpsSessionLoad();
    await jest.advanceTimersByTimeAsync(MIN_SKELETON_MS - 100);
    expect(perpsSessionLoaded()).toBe(false);
    await jest.advanceTimersByTimeAsync(200);
    await p;
    expect(perpsSessionLoaded()).toBe(true);
  });

  it('leaving and re-entering mid-load does not restart the wait; later visits are instant', async () => {
    let calls = 0;
    setBalanceLookup(() => { calls += 1; return new Promise<void>((res) => { setTimeout(res, 3000); }); });
    const a = ensurePerpsSessionLoad();
    await jest.advanceTimersByTimeAsync(1500);
    const b = ensurePerpsSessionLoad(); // user tabbed away and back
    expect(b).toBe(a);
    expect(calls).toBe(1);
    await jest.advanceTimersByTimeAsync(2000);
    await a;
    expect(perpsSessionLoaded()).toBe(true);
    await expect(ensurePerpsSessionLoad()).resolves.toBeUndefined(); // instant now
    expect(calls).toBe(1);
  });
});
