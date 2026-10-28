/**
 * Veltravia Wallet — Perps market search logic (pure, no UI).
 *
 * The Search screen (opened from the Perps home search icon) shows ONE market
 * list at a time, chosen by the tab strip, narrowed by the provider filter and
 * the search text, and ordered by the sort chip (Volume 24h by default).
 */
import { PERP_SECTIONS, type PerpMarket } from './perpsMarkets';
import type { PerpsVenue } from './perpsVenues';

export type SortKey = 'volume' | 'change' | 'price' | 'leverage' | 'name';
export type SortDir = 'desc' | 'asc';

export const SORT_OPTIONS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'volume', label: 'Volume (24h)' },
  { key: 'change', label: 'Price change (24h)' },
  { key: 'price', label: 'Price' },
  { key: 'leverage', label: 'Max leverage' },
  { key: 'name', label: 'Name' },
];

/** "favorites" is the star tab; the rest are the market sections. */
export const FAVORITES_TAB = 'favorites';
export const SEARCH_TABS: ReadonlyArray<{ key: string; title: string }> = PERP_SECTIONS.map((s) => ({
  key: s.key,
  title: s.title,
}));

export type ProviderFilter = 'all' | PerpsVenue;

export interface SearchRow {
  key: string; // unique per section+symbol
  section: string;
  market: PerpMarket;
}

/** "$1.70B Vol" / "$341.36M Vol" / "$90.65K Vol" -> a number for sorting. */
export function parseVolume(v: string): number {
  const m = /\$([\d.,]+)\s*([KMB]?)/i.exec(v);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ''));
  const mult = { '': 1, K: 1e3, M: 1e6, B: 1e9 }[m[2].toUpperCase() as '' | 'K' | 'M' | 'B'];
  return n * mult;
}

const venueOf = (m: PerpMarket): PerpsVenue => m.venue ?? 'hyperliquid';

export interface QueryOptions {
  tab: string;
  provider: ProviderFilter;
  query: string;
  sort: SortKey;
  dir: SortDir;
  favorites: ReadonlySet<string>;
  /** "Show in markets" prefs from Settings > Perps (hidden venues drop out). */
  venueVisible: Record<PerpsVenue, boolean>;
}

export const favKey = (m: PerpMarket) => `${venueOf(m)}:${m.symbol}`;

/** The rows to show for a tab + filters + text + sort. */
export function queryMarkets(o: QueryOptions): SearchRow[] {
  const q = o.query.trim().toLowerCase();
  const sections = o.tab === FAVORITES_TAB ? PERP_SECTIONS : PERP_SECTIONS.filter((s) => s.key === o.tab);
  const seen = new Set<string>();
  let rows: SearchRow[] = [];
  for (const s of sections) {
    for (const m of s.markets) {
      if (!o.venueVisible[venueOf(m)]) continue;
      if (o.provider !== 'all' && venueOf(m) !== o.provider) continue;
      if (o.tab === FAVORITES_TAB) {
        // a favorited market appears once, not once per section it lives in
        if (!o.favorites.has(favKey(m)) || seen.has(favKey(m))) continue;
        seen.add(favKey(m));
      }
      if (q && !m.symbol.toLowerCase().includes(q)) continue;
      rows.push({ key: `${s.key}:${m.symbol}`, section: s.key, market: m });
    }
  }
  const val = (r: SearchRow): number | string => {
    switch (o.sort) {
      case 'volume': return parseVolume(r.market.volume);
      case 'change': return r.market.change24h;
      case 'price': return r.market.price;
      case 'leverage': return r.market.leverage;
      default: return r.market.symbol.toLowerCase();
    }
  };
  rows = rows.slice().sort((a, b) => {
    const x = val(a); const y = val(b);
    const cmp = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
    return o.dir === 'desc' ? -cmp : cmp;
  });
  return rows;
}

/** Name sort reads naturally A to Z first; numeric sorts start high to low. */
export const defaultDir = (k: SortKey): SortDir => (k === 'name' ? 'asc' : 'desc');
