/**
 * Veltravia Wallet - pull-to-refresh behaviour shared by the wallet screens.
 *
 * One refresh at a time, a spinner that never flickers (a fast path still shows
 * for `minMs`), and failures reported in plain words while the screen keeps the
 * data it already had. Nothing is cleared on failure.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface RefreshOptions {
  /** Keep the spinner up at least this long so it reads as a refresh, ms. */
  minMs?: number;
  onError?: (error: unknown) => void;
}

export function useRefresh(work: () => Promise<void>, options: RefreshOptions = {}) {
  const { minMs = 550, onError } = options;
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const onRefresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    const started = Date.now();
    try {
      await work();
    } catch (e) {
      if (onError) onError(e);
    } finally {
      const left = minMs - (Date.now() - started);
      if (left > 0) await new Promise<void>((r) => setTimeout(() => r(), left));
      busy.current = false;
      if (alive.current) setRefreshing(false);
    }
  }, [work, minMs, onError]);

  return { refreshing, onRefresh };
}
