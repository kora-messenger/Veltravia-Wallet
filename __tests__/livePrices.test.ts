jest.mock('../src/services/api', () => ({ api: { prices: jest.fn() } }));

import { api } from '../src/services/api';
import { refreshPrices, toQuotes, refreshFailureMessage } from '../src/services/livePrices';

const prices = api.prices as jest.Mock;

describe('live prices', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); prices.mockReset(); });

  it('keeps only well formed quotes so a bad payload cannot paint the list', () => {
    const out = toQuotes([
      { symbol: 'btc', priceUsd: 80772, change24h: 0.98 },
      { symbol: 'ETH', priceUsd: 2347.4 },                       // change missing -> 0
      { symbol: 'BAD', priceUsd: 0 },                            // zero price
      { symbol: 'NOPE', priceUsd: '12' },                        // wrong type
      { priceUsd: 4 },                                           // no symbol
      null,
    ]);
    expect(out).toEqual([
      { symbol: 'BTC', priceUsd: 80772, change24h: 0.98 },
      { symbol: 'ETH', priceUsd: 2347.4, change24h: 0 },
    ]);
  });

  it('returns live quotes when the backend answers', async () => {
    prices.mockResolvedValue([{ symbol: 'BTC', priceUsd: 81000, change24h: 1.2 }]);
    const res = await refreshPrices();
    expect(res.ok).toBe(true);
    expect(res.quotes[0].priceUsd).toBe(81000);
  });

  it('says offline rather than pretending when the request fails', async () => {
    prices.mockRejectedValue(new Error('network'));
    const res = await refreshPrices();
    expect(res).toEqual({ ok: false, quotes: [], reason: 'offline' });
    expect(refreshFailureMessage(res.reason)).toMatch(/Couldn't reach the price feed/);
  });

  it('gives up on a hanging feed and reports a timeout', async () => {
    prices.mockImplementation(() => new Promise(() => {}));    // never settles
    const p = refreshPrices();
    jest.advanceTimersByTime(6100);
    const res = await p;
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('timeout');
    expect(refreshFailureMessage('timeout')).toMatch(/took too long/);
  });

  it('treats an empty answer as a failure, not as zero prices', async () => {
    prices.mockResolvedValue([]);
    const res = await refreshPrices();
    expect(res.ok).toBe(false);
    expect(res.quotes).toEqual([]);
  });
});
