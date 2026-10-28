import {
  buildOrderBook, ladderRows, barFractions, buySellRatio, formatBookSize, formatBookPrice,
  levelSize, snapToGroup, groupOptionsFor, isDefaultBookSettings, DEFAULT_BOOK_SETTINGS, BOOK_ROWS, GROUP_OPTIONS,
} from '../src/services/orderBook';

describe('order book engine', () => {
  const book = buildOrderBook('hyperliquid:BTC', 81449, 1, 0);

  it('builds 19 rows per side, best prices on either side of the mid', () => {
    expect(BOOK_ROWS).toBe(19);
    expect(book.bids).toHaveLength(19);
    expect(book.asks).toHaveLength(19);
    expect(book.bids[0].price).toBeLessThan(81449);
    expect(book.asks[0].price).toBeGreaterThan(81449);
    expect(book.asks[0].price).toBeGreaterThan(book.bids[0].price);
  });

  it('bids run down and asks run up in whole steps of the grouping', () => {
    for (let i = 1; i < 19; i++) {
      expect(book.bids[i - 1].price - book.bids[i].price).toBeCloseTo(1, 6);
      expect(book.asks[i].price - book.asks[i - 1].price).toBeCloseTo(1, 6);
    }
    const g10 = buildOrderBook('hyperliquid:BTC', 81449, 10, 0);
    expect(g10.bids[0].price % 10).toBe(0);
    expect(g10.asks[0].price % 10).toBe(0);
    expect(g10.asks[1].price - g10.asks[0].price).toBe(10);
  });

  it('is deterministic per tick and changes with the tick', () => {
    expect(buildOrderBook('hyperliquid:BTC', 81449, 1, 0)).toEqual(book);
    expect(buildOrderBook('hyperliquid:BTC', 81449, 1, 1)).not.toEqual(book);
  });

  it('ladder lists the far levels first and the touch last (the funnel)', () => {
    const rows = ladderRows(book, 'USD');
    expect(rows).toHaveLength(19);
    expect(rows[0].bid.price).toBe(book.bids[18].price);
    expect(rows[18].bid.price).toBe(book.bids[0].price);
    expect(rows[18].ask.price).toBe(book.asks[0].price);
  });

  it('USD size = size x price; BTC size = base units', () => {
    const l = { price: 81420, size: 2 };
    expect(levelSize(l, 'USD')).toBe(162840);
    expect(levelSize(l, 'BTC')).toBe(2);
  });

  it('bar fractions are scaled to the largest size on screen (max = 1)', () => {
    const f = barFractions(ladderRows(book, 'USD'));
    const all = f.flatMap((x) => [x.bid, x.ask]);
    expect(Math.max(...all)).toBeCloseTo(1, 9);
    expect(Math.min(...all)).toBeGreaterThan(0);
  });

  it('buy/sell ratio sums to exactly 100', () => {
    const r = buySellRatio(book);
    expect(r.buy + r.sell).toBe(100);
    expect(r.buy).toBeGreaterThan(0);
    expect(r.sell).toBeGreaterThan(0);
  });

  it('formats like the recording', () => {
    expect(formatBookSize(307192.4, 'USD')).toBe('307,192');
    expect(formatBookSize(3.0719, 'BTC')).toBe('3.072');
    expect(formatBookSize(0.0042, 'BTC')).toBe('0.0042');
    expect(formatBookPrice(81420, 1)).toBe('81,420');
    expect(formatBookPrice(81420.5, 0.1)).toBe('81,420.5');
  });

  it('grouping snaps down for bids and up for asks', () => {
    expect(snapToGroup(81447, 10, 'down')).toBe(81440);
    expect(snapToGroup(81447, 10, 'up')).toBe(81450);
  });

  it('settings: defaults are USD / 1, and group options follow price', () => {
    expect(GROUP_OPTIONS).toEqual([1, 2, 5, 10, 100]);
    expect(isDefaultBookSettings(DEFAULT_BOOK_SETTINGS)).toBe(true);
    expect(isDefaultBookSettings({ currency: 'BTC', group: 1 })).toBe(false);
    expect(isDefaultBookSettings({ currency: 'USD', group: 10 })).toBe(false);
    expect(groupOptionsFor(81449)).toEqual([1, 2, 5, 10, 100]);
    expect(groupOptionsFor(2370)).toEqual([1, 2, 5, 10, 100]);
    expect(groupOptionsFor(250)).toEqual([1, 2, 5, 10]);
    expect(groupOptionsFor(82)).toEqual([1, 2, 5]);
    expect(groupOptionsFor(5)).toEqual([1, 2, 5]);
  });

  it('small-price markets keep a sane tick (no zero-width ladder)', () => {
    const b = buildOrderBook('hyperliquid:HYPE', 82.128, 1, 0);
    expect(b.asks[0].price).toBeGreaterThan(b.bids[0].price);
    expect(b.bids[0].price - b.bids[1].price).toBeGreaterThan(0);
  });
});
