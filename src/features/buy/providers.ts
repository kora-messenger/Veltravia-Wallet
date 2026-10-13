/**
 * Onramp providers + quote engine (mock until the real aggregator lands).
 *
 * Behaviour copied from Trust's Buy recording:
 *  - Every amount change re-quotes: crypto amount AND the Pay-with card show
 *    skeletons together, because the amount decides which providers qualify.
 *  - Network latency is variable (a fast reply can land in ~0.25s, a slow one
 *    takes 2-3s). Simulated with a randomised delay.
 *  - Three outcomes: ok | below_min (red digits + "Min amount is X") |
 *    no_provider ("No available provider", quote "-").
 */
import { PER_USD } from './useRates';

export interface Provider {
  id: string;
  name: string;
  /** Short glyph text for the avatar (no emoji, no remote logos). */
  mark: string;
  markBg: string;
  markFg: string;
  /** Minimum / maximum in USD. */
  minUsd: number;
  maxUsd: number;
  /** Fiat currencies it serves (null = all). */
  currencies: string[] | null;
  /** Checkout URL opened after Continue. */
  url: string;
}

/** Trust's buy ceiling, verified from their app: 360,000 USD. Their APK does NOT hardcode
 *  per-country limits — the number arrives in the provider quote, converted per fiat. */
const MAX_USD = 360000;

export const PROVIDERS: Provider[] = [
  { id: 'revolutpay', name: 'Revolut Pay', mark: 'R Pay', markBg: '#FFFFFF', markFg: '#14152B', minUsd: 5, maxUsd: 8000, currencies: ['USD', 'EUR', 'GBP', 'PLN', 'CZK', 'SEK', 'NOK', 'DKK', 'CHF', 'RON', 'HUF', 'BGN'], url: 'https://exchange.mercuryo.io/' },
  { id: 'googlepay', name: 'Google Pay', mark: 'G Pay', markBg: '#FFFFFF', markFg: '#3C4043', minUsd: 10, maxUsd: 10000, currencies: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'PLN', 'CZK', 'SEK', 'NOK', 'DKK', 'CHF'], url: 'https://exchange.mercuryo.io/' },
  { id: 'banktransfer', name: 'Bank Transfer', mark: 'BK', markBg: '#0A3A94', markFg: '#FFFFFF', minUsd: 1, maxUsd: MAX_USD, currencies: null, url: 'https://exchange.mercuryo.io/' },
];

export type QuoteStatus = 'ok' | 'below_min' | 'over_max' | 'no_provider';

export interface Quote {
  status: QuoteStatus;
  cryptoAmount: string; // '' when not ok
  providers: Provider[]; // those that qualify (or all, for below_min, to keep the card)
  /** Best provider for the amount. */
  best: Provider | null;
  /** Minimum in the chosen fiat, when below_min. */
  minFiat?: number;
  /** Ceiling in the chosen fiat, when over_max (Trust shows "Max amount is X CUR"). */
  maxFiat?: number;
}

/** Per-currency minimum overrides measured from Trust (NGN min = 1,416). */
const MIN_FIAT: Record<string, number> = { NGN: 1416 };

const USD_PRICE: Record<string, number> = { ETH: 3500, BTC: 98000, BNB: 620, SOL: 170, USDT: 1 };

/** Compute the outcome synchronously; latency is simulated by the caller. */
export function computeQuote(amountFiat: number, fiat: string, crypto: string): Quote {
  const perUsd = PER_USD[fiat] ?? 1;
  const usd = amountFiat / perUsd;
  const serving = PROVIDERS.filter((p) => !p.currencies || p.currencies.includes(fiat));
  if (!serving.length) return { status: 'no_provider', cryptoAmount: '', providers: [], best: null };

  const lowestMinUsd = Math.min(...serving.map((p) => p.minUsd));
  const minFiat = MIN_FIAT[fiat] ?? Math.ceil(lowestMinUsd * perUsd);
  if (amountFiat < minFiat) {
    return { status: 'below_min', cryptoAmount: '', providers: serving, best: serving[0], minFiat };
  }
  // Over the ceiling: the quote answers with the limit, and the app renders it red.
  const overallMaxFiat = Math.round(MAX_USD * perUsd);
  if (usd > MAX_USD) {
    return { status: 'over_max', cryptoAmount: '', providers: serving, best: serving[0], maxFiat: overallMaxFiat };
  }
  // Once an amount clears the currency floor, a provider qualifies when it is under its max
  // and (for the lowest-minimum provider) the currency floor already stands in for its minimum.
  const qualifying = serving.filter(
    (p) => usd <= p.maxUsd && (usd >= p.minUsd || (MIN_FIAT[fiat] != null && p.minUsd === lowestMinUsd)),
  );
  if (!qualifying.length) return { status: 'no_provider', cryptoAmount: '', providers: serving, best: serving[0], maxFiat: overallMaxFiat };

  const units = usd / (USD_PRICE[crypto] ?? 1);
  return { status: 'ok', cryptoAmount: units.toFixed(5), providers: qualifying, best: qualifying[0] };
}

/** Simulated network latency: mostly 0.6-1.8s, occasionally slow (2-3s) or instant (0.25s). */
export function simulatedLatency(): number {
  const r = Math.random();
  if (r < 0.12) return 250;
  if (r > 0.85) return 2000 + Math.random() * 1000;
  return 600 + Math.random() * 1200;
}
