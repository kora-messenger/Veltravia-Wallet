/**
 * Veltravia Wallet — market data (Phase 1: local dataset).
 *
 * Shapes are final; the mock generator below is replaced in Phase 2 by
 * api.prices() from the backend. Everything the Markets screen renders
 * comes from here, so the swap touches one file.
 */

export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  glyph: 'btc' | 'bnb' | 'eth' | 'sol' | 'trx' | 'dollar';
  color: string; // glyph circle background
  priceUsd: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  history: number[]; // sparkline, oldest -> newest
}

export const GLOBAL_STATS = {
  totalMarketCap: 2_410_000_000_000,
  volume24h: 89_200_000_000,
  btcDominance: 56.8,
};

/** Deterministic seeded series so sparks are stable across renders. */
function series(seed: string, points = 24, drift: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  const out: number[] = [];
  let v = 50;
  for (let i = 0; i < points; i++) {
    h = (h * 1103515245 + 12345) % 2147483648;
    const noise = ((h / 2147483648) - 0.5) * 6;
    v += noise + drift;
    out.push(Number(v.toFixed(2)));
  }
  return out;
}

export const MARKET_COINS: MarketCoin[] = [
  {
    id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', glyph: 'btc', color: '#F7931A',
    priceUsd: 63240.12, change24h: 2.41, marketCap: 1_247_000_000_000, volume24h: 38_400_000_000,
    history: series('btc', 24, 0.4),
  },
  {
    id: 'ethereum', symbol: 'ETH', name: 'Ethereum', glyph: 'eth', color: '#627EEA',
    priceUsd: 2438.55, change24h: 1.16, marketCap: 293_000_000_000, volume24h: 14_900_000_000,
    history: series('eth', 24, 0.25),
  },
  {
    id: 'binancecoin', symbol: 'BNB', name: 'BNB', glyph: 'bnb', color: '#F3BA2F',
    priceUsd: 584.32, change24h: -0.84, marketCap: 86_100_000_000, volume24h: 1_900_000_000,
    history: series('bnb', 24, -0.15),
  },
  {
    id: 'solana', symbol: 'SOL', name: 'Solana', glyph: 'sol', color: '#9945FF',
    priceUsd: 172.48, change24h: 5.92, marketCap: 81_300_000_000, volume24h: 3_700_000_000,
    history: series('sol', 24, 0.9),
  },
  {
    id: 'tether', symbol: 'USDT', name: 'Tether USD', glyph: 'dollar', color: '#26A17B',
    priceUsd: 1.0, change24h: 0.01, marketCap: 120_000_000_000, volume24h: 52_300_000_000,
    history: series('usdt', 24, 0),
  },
  {
    id: 'polygon', symbol: 'POL', name: 'Polygon', glyph: 'dollar', color: '#8247E5',
    priceUsd: 0.4721, change24h: -2.35, marketCap: 7_100_000_000, volume24h: 320_000_000,
    history: series('pol', 24, -0.45),
  },
  {
    id: 'tron', symbol: 'TRX', name: 'TRON', glyph: 'trx', color: '#EF0027',
    priceUsd: 0.1648, change24h: 0.62, marketCap: 14_400_000_000, volume24h: 410_000_000,
    history: series('trx', 24, 0.12),
  },
  {
    id: 'litecoin', symbol: 'LTC', name: 'Litecoin', glyph: 'dollar', color: '#345D9D',
    priceUsd: 74.85, change24h: 1.87, marketCap: 5_600_000_000, volume24h: 380_000_000,
    history: series('ltc', 24, 0.3),
  },
  {
    id: 'chainlink', symbol: 'LINK', name: 'Chainlink', glyph: 'dollar', color: '#2A5ADA',
    priceUsd: 16.42, change24h: -1.12, marketCap: 9_700_000_000, volume24h: 460_000_000,
    history: series('link', 24, -0.2),
  },
  {
    id: 'uniswap', symbol: 'UNI', name: 'Uniswap', glyph: 'dollar', color: '#FF007A',
    priceUsd: 8.94, change24h: 3.28, marketCap: 5_400_000_000, volume24h: 210_000_000,
    history: series('uni', 24, 0.55),
  },
];
