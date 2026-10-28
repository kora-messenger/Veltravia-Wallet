import {
  snapHeights, settleSnap, amountFromPercent, percentFromAmount, positionSize,
  liquidationPrice, ctaFor, sideTitle, formatUsd, formatSize, feeFor, ohlcHeader,
  formatOhlcDelta, SLIDER_STOPS, FUND_CURRENCIES, TRADE_FEE_PCT,
} from '../src/services/perpsTrade';

describe('perps trade ticket logic (Trust recording)', () => {
  it('titles match the sheet header', () => {
    expect(sideTitle('long')).toBe('Open Long');
    expect(sideTitle('short')).toBe('Open Short');
  });

  it('has the recording\'s five slider stops and 0.15% fee', () => {
    expect(SLIDER_STOPS).toEqual([0, 25, 50, 75, 100]);
    expect(TRADE_FEE_PCT).toBe(0.15);
    expect(feeFor(1000)).toBeCloseTo(1.5, 4);
  });

  it('snap heights are ordered peek < half < full', () => {
    const h = snapHeights(844, 44);
    expect(h.peek).toBeLessThan(h.half);
    expect(h.half).toBeLessThan(h.full);
    expect(h.full).toBe(844 - 44 - 8);
  });

  it('settles to the nearest snap; a fling carries further', () => {
    const h = snapHeights(844, 44);
    expect(settleSnap(h.half + 10, 0, h)).toBe('half');
    expect(settleSnap(h.half, 1.5, h)).toBe('peek');     // fast drag down
    expect(settleSnap(h.half, -1.5, h)).toBe('full');    // fast drag up
    expect(settleSnap(h.peek + 20, 0, h)).toBe('peek');
    expect(settleSnap(h.full - 20, 0, h)).toBe('full');
  });

  it('slider -> amount snaps to stops and never exceeds the balance', () => {
    expect(amountFromPercent(0, 200)).toBe(0);
    expect(amountFromPercent(24, 200)).toBe(50);   // within 2 of the 25 stop
    expect(amountFromPercent(100, 200)).toBe(200);
    expect(amountFromPercent(250, 200)).toBe(200);
    expect(amountFromPercent(-5, 200)).toBe(0);
    expect(percentFromAmount(50, 200)).toBe(25);
    expect(percentFromAmount(50, 0)).toBe(0);
  });

  it('size = margin x leverage (Cross 3x default)', () => {
    expect(positionSize(100, 3)).toBe(300);
    expect(positionSize(0, 3)).toBe(0);
    expect(formatSize(0)).toBe('$0.00');
  });

  it('liquidation price is empty until an amount is entered ("-")', () => {
    expect(liquidationPrice(81500, 3, 'long', 0)).toBeNull();
    const l = liquidationPrice(81500, 3, 'long', 100)!;
    const s = liquidationPrice(81500, 3, 'short', 100)!;
    expect(l).toBeLessThan(81500);
    expect(s).toBeGreaterThan(81500);
  });

  it('CTA is "Fund wallet" at $0 balance, then Open Long/Short', () => {
    expect(ctaFor('short', 0, 0)).toEqual({ label: 'Fund wallet', action: 'fund' });
    expect(ctaFor('long', 100, 0).action).toBe('disabled');
    expect(ctaFor('long', 100, 50)).toEqual({ label: 'Open Long', action: 'open' });
    expect(ctaFor('short', 100, 500).label).toBe('Insufficient balance');
  });

  it('money formatting', () => {
    expect(formatUsd(0)).toBe('$0');
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(81505)).toBe('$81,505');
  });

  it('OHLC scrub header: signed delta and colour direction', () => {
    const up = ohlcHeader({ t: 0, o: 81000, h: 81200, l: 80900, c: 81100 });
    expect(up.up).toBe(true);
    expect(formatOhlcDelta(up)).toBe('+$100.0 (0.12%)');
    const dn = ohlcHeader({ t: 0, o: 81525, h: 81551, l: 81416, c: 81499 });
    expect(dn.up).toBe(false);
    expect(formatOhlcDelta(dn)).toBe('-$26.0 (0.03%)');
  });

  it('fund-wallet currency list matches the Pay-with screen', () => {
    expect(FUND_CURRENCIES.map((c) => c.code)).toEqual(['NGN', 'USD', 'EUR', 'GBP']);
  });
});
