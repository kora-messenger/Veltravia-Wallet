/**
 * Veltravia Wallet - Perps Activity filtering (pure, no UI).
 *
 * The filter sheet edits a PerpsActivityFilters value; this module is the one
 * place that says what such a value MEANS for a list of activity items. There
 * is no perps history source yet (live trading follows the signing work), so
 * the Activity screen passes it an empty list today. When the feed lands it
 * only has to produce PerpsActivityItem[] and the filtering is already right.
 */
import { PERP_SECTIONS } from '../../services/perpsMarkets';

export type PerpsProvider = 'hyperliquid' | 'aster';
export type PerpsActivityType = 'order' | 'trade' | 'transfer';
export type PerpsActivityStatus = 'completed' | 'submitted' | 'processing' | 'failed';
export type PerpsActivityDate = '7d' | '30d' | '90d' | 'custom';

export interface PerpsActivityFilters {
  /** empty = every provider. */
  providers: PerpsProvider[];
  /** market symbols from PERP_SECTIONS; empty = every asset. */
  assets: string[];
  /** empty = every type. */
  type: PerpsActivityType[];
  /** funding payments are hidden unless this is on. */
  showFundingPayment: boolean;
  /** empty = every status. */
  status: PerpsActivityStatus[];
  /** null = all time. */
  date: PerpsActivityDate | null;
  /** epoch ms; only meaningful when date === 'custom'. */
  customStart: number | null;
  customEnd: number | null;
}

export const DEFAULT_PERPS_ACTIVITY_FILTERS: PerpsActivityFilters = {
  providers: [],
  assets: [],
  type: [],
  showFundingPayment: false,
  status: [],
  date: null,
  customStart: null,
  customEnd: null,
};

/** What the Activity feed will hand us once live history exists. */
export interface PerpsActivityItem {
  id: string;
  provider: PerpsProvider;
  /** market symbol, e.g. "BTC" */
  asset: string;
  type: PerpsActivityType;
  status: PerpsActivityStatus;
  /** a funding payment is its own kind of row, shown only on request */
  isFunding?: boolean;
  /** epoch ms */
  timestamp: number;
}

const DAY = 86_400_000;
const PRESET_DAYS: Record<'7d' | '30d' | '90d', number> = { '7d': 7, '30d': 30, '90d': 90 };

const sameSet = <T,>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

export function filtersEqual(a: PerpsActivityFilters, b: PerpsActivityFilters): boolean {
  return (
    sameSet(a.providers, b.providers) &&
    sameSet(a.assets, b.assets) &&
    sameSet(a.type, b.type) &&
    a.showFundingPayment === b.showFundingPayment &&
    sameSet(a.status, b.status) &&
    a.date === b.date &&
    (a.date !== 'custom' || (a.customStart === b.customStart && a.customEnd === b.customEnd))
  );
}

/** True when anything differs from the defaults (drives Reset and the header dot). */
export function perpsFiltersActive(f: PerpsActivityFilters): boolean {
  return !filtersEqual(f, DEFAULT_PERPS_ACTIVITY_FILTERS);
}

/** How many separate filters are set, for the badge on the Assets row etc. */
export function activeFilterCount(f: PerpsActivityFilters): number {
  return (
    (f.providers.length ? 1 : 0) +
    (f.assets.length ? 1 : 0) +
    (f.type.length ? 1 : 0) +
    (f.showFundingPayment ? 1 : 0) +
    (f.status.length ? 1 : 0) +
    (f.date ? 1 : 0)
  );
}

/** The [from, to] window a date filter means, or null for "all time". */
export function dateRange(f: PerpsActivityFilters, now: number = Date.now()): [number, number] | null {
  if (!f.date) return null;
  if (f.date === 'custom') {
    if (f.customStart == null || f.customEnd == null) return null;
    return [Math.min(f.customStart, f.customEnd), Math.max(f.customStart, f.customEnd)];
  }
  return [now - PRESET_DAYS[f.date] * DAY, now];
}

/** Keep start <= end after one side was edited: the other side is dragged along. */
export function clampRange(
  edited: 'start' | 'end',
  start: number,
  end: number,
): { start: number; end: number } {
  if (start <= end) return { start, end };
  return edited === 'start' ? { start, end: start } : { start: end, end };
}

/** The filtering itself. No filters set -> everything comes back, in order. */
export function applyPerpsFilters(
  items: readonly PerpsActivityItem[],
  f: PerpsActivityFilters,
  now: number = Date.now(),
): PerpsActivityItem[] {
  const range = dateRange(f, now);
  return items.filter((it) => {
    if (f.providers.length && !f.providers.includes(it.provider)) return false;
    if (f.assets.length && !f.assets.includes(it.asset)) return false;
    if (f.type.length && !f.type.includes(it.type)) return false;
    if (f.status.length && !f.status.includes(it.status)) return false;
    if (it.isFunding && !f.showFundingPayment) return false;
    if (range && (it.timestamp < range[0] || it.timestamp > range[1])) return false;
    return true;
  });
}

// ---- the assets the picker offers: the app's real market list --------------------

export interface PerpsAssetOption {
  symbol: string;
  provider: PerpsProvider;
  section: string;
}

/** Every supported market once, in the order the Perps lists show them. */
export function supportedAssets(): PerpsAssetOption[] {
  const seen = new Set<string>();
  const out: PerpsAssetOption[] = [];
  for (const sec of PERP_SECTIONS) {
    for (const m of sec.markets) {
      if (seen.has(m.symbol)) continue;
      seen.add(m.symbol);
      out.push({ symbol: m.symbol, provider: m.venue ?? 'hyperliquid', section: sec.title });
    }
  }
  return out;
}

/** Narrow the picker by the search box (symbol match) and, optionally, the chosen providers. */
export function searchAssets(
  all: readonly PerpsAssetOption[],
  query: string,
  providers: readonly PerpsProvider[] = [],
): PerpsAssetOption[] {
  const q = query.trim().toLowerCase();
  return all.filter(
    (a) =>
      (!providers.length || providers.includes(a.provider)) &&
      (!q || a.symbol.toLowerCase().includes(q)),
  );
}
