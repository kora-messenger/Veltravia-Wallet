/**
 * Veltravia Wallet - "should this chart be allowed to draw?"
 *
 * Candles are price data. Drawing them while the device has no network shows a
 * chart the user cannot trust (and the numbers behind it are a local series,
 * not a live feed), so the chart area asks this gate first: checking, online,
 * or offline. Coming back to the app re-checks, so reconnecting fixes the chart
 * without the user hunting for a retry button.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { checkOnline } from '../services/connectivity';

export type OnlineState = 'checking' | 'online' | 'offline';

export function useOnlineGate() {
  const [state, setState] = useState<OnlineState>('checking');
  const alive = useRef(true);

  const recheck = useCallback(async () => {
    setState('checking');
    const verdict = await checkOnline();
    if (alive.current) setState(verdict.online ? 'online' : 'offline');
  }, []);

  useEffect(() => {
    alive.current = true;
    recheck();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') recheck();
    });
    return () => {
      alive.current = false;
      sub.remove();
    };
  }, [recheck]);

  return { state, recheck };
}
