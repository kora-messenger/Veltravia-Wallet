import { headerSwap, headerAmount, SWAP_START, SWAP_SPAN } from '../src/services/headerCollapse';

describe('Home header collapse: wallet name -> balance amount', () => {
  it('at the top the name is fully shown and the amount is hidden', () => {
    const s = headerSwap(0);
    expect(s.progress).toBe(0);
    expect(s.nameOpacity).toBe(1);
    expect(s.amountOpacity).toBe(0);
    expect(s.nameShift).toBe(0);
  });

  it('stays unchanged until the card amount reaches the header line', () => {
    expect(headerSwap(SWAP_START - 1).progress).toBe(0);
    expect(headerSwap(SWAP_START - 40).amountOpacity).toBe(0);
  });

  it('once scrolled well past the balance, the amount is shown and the name is gone', () => {
    const s = headerSwap(SWAP_START + SWAP_SPAN + 200);
    expect(s.progress).toBe(1);
    expect(s.nameOpacity).toBe(0);
    expect(s.amountOpacity).toBe(1);
    expect(s.amountShift).toBe(0);
  });

  it('the name and the amount never overlap at full strength (no double text)', () => {
    for (let y = SWAP_START; y <= SWAP_START + SWAP_SPAN; y += 1) {
      const s = headerSwap(y);
      expect(s.nameOpacity + s.amountOpacity).toBeLessThanOrEqual(1.0001);
    }
  });

  it('is monotonic: scrolling further never brings the name back', () => {
    let prevName = 1;
    let prevAmount = 0;
    for (let y = 0; y <= 300; y += 2) {
      const s = headerSwap(y);
      expect(s.nameOpacity).toBeLessThanOrEqual(prevName + 1e-9);
      expect(s.amountOpacity).toBeGreaterThanOrEqual(prevAmount - 1e-9);
      prevName = s.nameOpacity;
      prevAmount = s.amountOpacity;
    }
  });

  it('scrolling back up restores the name (symmetric)', () => {
    expect(headerSwap(400).nameOpacity).toBe(0);
    expect(headerSwap(0).nameOpacity).toBe(1);
  });

  it('overscroll (negative offset) is clamped', () => {
    const s = headerSwap(-120);
    expect(s.progress).toBe(0);
    expect(s.nameOpacity).toBe(1);
  });

  it('header amount follows the eye toggle and the card format', () => {
    expect(headerAmount(1248.42, false)).toBe('$1,248.42');
    expect(headerAmount(1248.42, true)).toBe('$••••••');
    expect(headerAmount(0, false)).toBe('$0.00');
    expect(headerAmount(1234567.5, false)).toBe('$1,234,567.50');
  });
});
