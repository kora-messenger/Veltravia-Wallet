/**
 * Buy quote + payment-method loading (mock until the onramp backend lands).
 *
 * Mirrors the recording: opening Buy shows skeletons for the crypto amount
 * and the "Pay with" card, then both resolve. Changing the amount or
 * currency re-shows the crypto skeleton until the quote returns.
 */
import { useEffect, useRef, useState } from 'react';

/** Approximate USD price per unit for the mock quote. */
const USD_PRICE: Record<string, number> = { ETH: 3500, BTC: 98000, BNB: 620, SOL: 170, USDT: 1 };
/** Approximate units of currency per 1 USD for the mock quote. */
export const PER_USD: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, NGN: 1560, AED: 3.67, ARS: 1000, AUD: 1.5, BDT: 120, BGN: 1.8, BMD: 1,
  BND: 1.35, BOB: 6.9, BRL: 5.5, BWP: 13.6, BYN: 3.3, CAD: 1.38, CHF: 0.88, CLP: 950, CNY: 7.2, COP: 4100,
  CRC: 520, CZK: 23, DJF: 178, DKK: 6.9, DZD: 134, EGP: 49, ETB: 120, GEL: 2.7, GHS: 15, HKD: 7.8,
  HRK: 6.9, HUF: 360, IDR: 16000, ILS: 3.7, INR: 84, JPY: 150, KES: 129, KRW: 1380, KWD: 0.31, KZT: 490,
  LKR: 300, MAD: 10, MXN: 19.5, MYR: 4.4, NOK: 10.8, NZD: 1.65, PEN: 3.75, PHP: 57, PKR: 278, PLN: 4,
  QAR: 3.64, RON: 4.6, RSD: 108, RUB: 95, SAR: 3.75, SEK: 10.5, SGD: 1.33, THB: 34, TRY: 34, TWD: 32,
  TZS: 2700, UAH: 41, UGX: 3700, UYU: 40, VND: 25000, XAF: 600, XOF: 600, ZAR: 18, ZMW: 27,
};

export function useBuyQuote(amount: string, fiat: string, crypto: string) {
  const [loading, setLoading] = useState(true);
  const [cryptoAmount, setCryptoAmount] = useState<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const n = parseFloat(amount.replace(/,/g, ''));
    if (!amount || isNaN(n) || n <= 0) {
      setCryptoAmount('');
      // Empty amount: Trust leaves the grey bar until a quote exists.
      setLoading(true);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => {
      const usd = n / (PER_USD[fiat] ?? 1);
      const units = usd / (USD_PRICE[crypto] ?? 1);
      setCryptoAmount(units.toFixed(8));
      setLoading(false);
    }, 650);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [amount, fiat, crypto]);

  return { loading, cryptoAmount };
}

/** Payment methods load once, ~900ms after Buy opens. */
export function usePaymentMethod() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);
  return { loading, label: 'Bank Transfer' };
}
