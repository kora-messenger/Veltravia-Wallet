/**
 * Veltravia Wallet - pull-down-to-reload WITHOUT a native indicator.
 *
 * RefreshControl always paints something (Android's spinner circle, iOS's
 * activity wheel), even with `refreshing={false}`. The Activity screen wants
 * the shimmer skeleton to be the only loading state, so this reads the
 * overscroll itself and fires `onReload` once when the user drags past the
 * threshold and lets go. Nothing is drawn by the gesture.
 *
 * Spread `bind` onto a ScrollView and pass `onScroll` yourself (screens that
 * already animate on scroll merge it into their own handler).
 */
import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/** How far past the top (dp) a drag must go to count as a pull. */
export const PULL_THRESHOLD = 64;

export function usePullToReload(onReload: () => void, enabled: boolean = true) {
  const maxPull = useRef(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    // negative offset = dragging down past the top (iOS bounce / Android overscroll)
    if (y < 0) maxPull.current = Math.max(maxPull.current, -y);
  }, []);

  const release = useCallback(() => {
    const pulled = maxPull.current;
    maxPull.current = 0;
    if (enabled && pulled >= PULL_THRESHOLD) onReload();
  }, [enabled, onReload]);

  return {
    onScroll,
    bind: {
      scrollEventThrottle: 16,
      onScrollEndDrag: release,
      bounces: true,
      alwaysBounceVertical: true,
      overScrollMode: 'always' as const,
    },
  };
}
