/**
 * Veltravia Wallet — perps venue preferences (Hyperliquid / Aster).
 *
 * Persisted per venue in encrypted settings:
 *   - showInMarkets: whether the venue's markets appear in the Perps lists.
 *   - assetMode (Aster only): single-asset or multi-asset mode.
 */
import { useSyncExternalStore } from 'react';
import { readSettings, writeSettings } from '../core/storage/secureStorage';

export type PerpsVenue = 'hyperliquid' | 'aster';
export type AsterAssetMode = 'single' | 'multi';

export interface VenuePrefs {
  showInMarkets: boolean;
  assetMode?: AsterAssetMode;
}

const DEFAULTS: Record<PerpsVenue, VenuePrefs> = {
  hyperliquid: { showInMarkets: true },
  aster: { showInMarkets: true, assetMode: 'single' },
};

interface Store {
  hyperliquid: VenuePrefs;
  aster: VenuePrefs;
}

const KEY = 'perpsVenuePrefs';

let store: Store = { hyperliquid: { ...DEFAULTS.hyperliquid }, aster: { ...DEFAULTS.aster } };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function persist() {
  try {
    await writeSettings({ [KEY]: store });
  } catch {
    /* storage unavailable: prefs stay in memory for this session */
  }
}

/** Called once at app start (Navigation) so toggles survive restarts. */
export async function loadVenuePrefs(): Promise<void> {
  if (loaded) return;
  try {
    const s = await readSettings();
    const raw = s[KEY];
    if (raw && typeof raw === 'object') {
      store = {
        hyperliquid: { ...DEFAULTS.hyperliquid, ...(raw.hyperliquid ?? {}) },
        aster: { ...DEFAULTS.aster, ...(raw.aster ?? {}) },
      };
    }
  } catch {
    /* defaults */
  }
  loaded = true;
  emit();
}

export function getVenuePrefs(venue: PerpsVenue): VenuePrefs {
  return store[venue];
}

export function setShowInMarkets(venue: PerpsVenue, show: boolean) {
  store = { ...store, [venue]: { ...store[venue], showInMarkets: show } };
  emit();
  persist();
}

export function setAsterAssetMode(mode: AsterAssetMode) {
  store = { ...store, aster: { ...store.aster, assetMode: mode } };
  emit();
  persist();
}

export function resetVenuePrefs() {
  store = { hyperliquid: { ...DEFAULTS.hyperliquid }, aster: { ...DEFAULTS.aster } };
  loaded = false;
  emit();
}

/** Reactive hook: re-renders when the venue's prefs change. */
export function useVenuePrefs(venue: PerpsVenue): VenuePrefs {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => getVenuePrefs(venue),
  );
}
