/**
 * useBuyQuote: debounced quoting with a loading flag.
 *
 * The recording shows the skeletons appear on EVERY keystroke and resolve
 * after a variable delay. Rapid typing keeps the skeleton up (each keystroke
 * cancels the pending response) and only the last amount's answer lands.
 * An empty amount never loads: the quote shows "-" and the card stays put.
 */
import { useEffect, useRef, useState } from 'react';
import { Quote, computeQuote, simulatedLatency } from './providers';

export function useBuyQuote(amount: string, fiat: string, crypto: string) {
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0) {
      setLoading(false);
      setQuote(null);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => {
      setQuote(computeQuote(n, fiat, crypto));
      setLoading(false);
    }, simulatedLatency());
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [amount, fiat, crypto]);

  return { loading, quote };
}
