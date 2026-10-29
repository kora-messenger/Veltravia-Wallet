/**
 * Home header collapse (Oct 29 request): once the Total Balance card has
 * scrolled up under the header, the pill swaps the wallet name for the
 * balance amount. The swap is a short cross-fade + slide, not a hard cut, and
 * runs over SWAP_SPAN px of scroll so it feels attached to the finger.
 *
 * The swap starts just before the in-card amount reaches the pill's line and
 * finishes just after, so the two amounts never show at once.
 */

/**
 * Scroll offset (px) at which the card's amount text reaches the pill's line.
 * Geometry: content paddingTop 68 + card paddingTop 16 + label row ~16 +
 * marginTop 4 = amount top 104; amount centre ~ 104 + 17 = 121; header pill
 * centre = top 4 + paddingTop 4 + 23 = 31  =>  121 - 31 = 90.
 */
export const SWAP_START = 80;
/** Scroll distance (px) over which the name fades out and the amount fades in. */
export const SWAP_SPAN = 34;

export interface HeaderSwap {
  /** 0 = wallet name fully shown, 1 = balance amount fully shown */
  progress: number;
  /** opacity / translateY for the wallet name */
  nameOpacity: number;
  nameShift: number;
  /** opacity / translateY for the balance amount */
  amountOpacity: number;
  amountShift: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function headerSwap(scrollY: number, start = SWAP_START, span = SWAP_SPAN): HeaderSwap {
  const p = clamp01((scrollY - start) / span);
  return {
    progress: p,
    // the name leaves a touch faster than the amount arrives (no double-text overlap)
    nameOpacity: clamp01(1 - p * 1.6),
    nameShift: p === 0 ? 0 : -10 * p,
    amountOpacity: clamp01((p - 0.35) * 1.6),
    amountShift: 10 * (1 - p),
  };
}

/** Header amount text: respects the eye toggle and keeps the dollar format. */
export function headerAmount(total: number, hidden: boolean): string {
  if (hidden) return '$••••••';
  return `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
