/**
 * Veltravia Wallet — recently viewed Perps markets (the "Recents" row on the
 * Search market screen, Trust parity).
 *
 * A market becomes "recent" the first time the user taps its row. Kept as
 * venue+symbol pairs (public dataset keys — nothing about the wallet or the
 * user is stored), newest first, capped at 8, persisted in settings.
 */
import { useSyncExternalStore } from 'react';
import { readSettings, writeSettings } from '../core/storage/secureStorage';
import type { PerpsVenue } from './perpsVenues';

const KEY = 'perpsMarketRecents';
const MAX = 8;

export interface RecentMarketRef {
  venue: PerpsVenue;
  symbol: string;
}

let recents: RecentMarketRef[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function persist() {
  try {
    await writeSettings({ [KEY]: recents });
  } catch {
    /* storage unavailable: recents stay in memory for this session */
  }
}

export async function loadPerpsRecents(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const s = await readSettings();
    if (Array.isArray(s[KEY])) {
      recents = s[KEY].filter(
        (r: unknown): r is RecentMarketRef =>
          !!r && typeof r === 'object' && typeof (r as RecentMarketRef).symbol === 'string',
      ).slice(0, MAX);
      emit();
    }
  } catch {
    /* start empty */
  }
}

/** Add (or bump to front) a market. */
export function addPerpsRecent(ref: RecentMarketRef) {
  const k = (r: RecentMarketRef) => `${r.venue}:${r.symbol}`;
  const rest = recents.filter((r) => k(r) !== k(ref));
  recents = [ref, ...rest].slice(0, MAX);
  emit();
  persist();
}

export function clearPerpsRecents() {
  recents = [];
  emit();
  persist();
}

/** Non-hook read for tests and one-off checks. */
export function getPerpsRecents(): RecentMarketRef[] {
  return recents;
}

export function resetPerpsRecents() {
  recents = [];
  loaded = false;
  emit();
}

export function usePerpsRecents(): RecentMarketRef[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => recents,
  );
}
