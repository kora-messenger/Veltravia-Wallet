/**
 * Veltravia Wallet — Perps favorite markets (the star tab on Search market).
 *
 * Persisted in encrypted settings, keyed "<venue>:<symbol>". One list per
 * install; the market data itself is a public dataset, so nothing about the
 * user's wallet or identity is stored here.
 */
import { useSyncExternalStore } from 'react';
import { readSettings, writeSettings } from '../core/storage/secureStorage';

const KEY = 'perpsFavorites';

let favs: ReadonlySet<string> = new Set();
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function persist() {
  try {
    await writeSettings({ [KEY]: Array.from(favs) });
  } catch {
    /* storage unavailable: favorites stay in memory for this session */
  }
}

export async function loadPerpsFavorites(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const s = await readSettings();
    if (Array.isArray(s[KEY])) {
      favs = new Set(s[KEY].filter((x: unknown): x is string => typeof x === 'string'));
      emit();
    }
  } catch {
    /* start empty */
  }
}

export function toggleFavorite(key: string) {
  const next = new Set(favs);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  favs = next;
  emit();
  persist();
}

export function resetPerpsFavorites() {
  favs = new Set();
  loaded = false;
  emit();
}

export function usePerpsFavorites(): ReadonlySet<string> {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => favs,
  );
}
