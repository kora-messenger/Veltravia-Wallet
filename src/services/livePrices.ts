/**
 * Veltravia Wallet - live price refresh (pull to refresh).
 *
 * The bundle ships a snapshot of prices (services/marketData). This asks our own
 * backend for fresh ones and reports back whether it worked, so a screen can be
 * honest: "live" when the feed answered, "saved prices" when it did not. It
 * NEVER invents numbers to look refreshed.
 *
 * Addresses never touch a third party here: the request goes to
 * APP_CONFIG.API_BASE_URL, our own gateway.
 */
import { api } from './api';

export interface PriceQuote {
  symbol: string;
  priceUsd: number;
  change24h: number;
}

export interface RefreshResult {
  ok: boolean;
  quotes: PriceQuote[];
  /** Why it failed, when it did: shown to the user in plain words. */
  reason?: string;
}

const TIMEOUT_MS = 6000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); },
           (e) => { clearTimeout(t); reject(e); });
  });
}

/** Turn the backend payload into the shape a screen can merge, dropping junk. */
export function toQuotes(rows: unknown): PriceQuote[] {
  if (!Array.isArray(rows)) return [];
  const out: PriceQuote[] = [];
  for (const r of rows) {
    const row = r as { symbol?: unknown; priceUsd?: unknown; change24h?: unknown };
    if (typeof row?.symbol !== 'string') continue;
    if (typeof row.priceUsd !== 'number' || !isFinite(row.priceUsd) || row.priceUsd <= 0) continue;
    const change = typeof row.change24h === 'number' && isFinite(row.change24h) ? row.change24h : 0;
    out.push({ symbol: row.symbol.toUpperCase(), priceUsd: row.priceUsd, change24h: change });
  }
  return out;
}

export async function refreshPrices(): Promise<RefreshResult> {
  try {
    const rows = await withTimeout(api.prices(), TIMEOUT_MS);
    const quotes = toQuotes(rows);
    if (!quotes.length) return { ok: false, quotes: [], reason: 'empty' };
    return { ok: true, quotes };
  } catch (e) {
    const reason = e instanceof Error && e.message === 'timeout' ? 'timeout' : 'offline';
    return { ok: false, quotes: [], reason };
  }
}

/** Plain-language line for the toast, never a stack trace. */
export function refreshFailureMessage(reason?: string): string {
  return reason === 'timeout'
    ? 'The price feed took too long. Showing the last prices.'
    : 'Couldn\'t reach the price feed. Showing the last prices.';
}
