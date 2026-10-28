/**
 * Veltravia Wallet — perps markets (local dataset until the backend feed).
 *
 * Mirrors Trust's Perps home: sections Popular / New / Crypto / Stocks /
 * Forex / Commodities / Meme, each a list of markets with max leverage, 24h
 * volume, price, 24h change and a sparkline. Shapes are final; Phase 2
 * replaces `PERP_SECTIONS` with api.perpsMarkets() from the backend.
 */
export interface PerpMarket {
  symbol: string;
  /** Which perps venue lists this market (filters via "Show in markets"). */
  venue?: 'hyperliquid' | 'aster';
  leverage: number; // max leverage, e.g. 40 -> "40x"
  volume: string; // pre-formatted, e.g. "$1.70B Vol"
  price: number;
  change24h: number; // percent
  /** brand tile when no official coin mark exists */
  tile?: { bg: string; fg: string; text: string };
}

export interface PerpSection {
  key: string;
  title: string;
  markets: PerpMarket[];
}

const t = (bg: string, text: string, fg = '#FFFFFF') => ({ bg, fg, text });

export const PERP_SECTIONS: PerpSection[] = [
  {
    key: 'popular', title: 'Popular',
    markets: [
      { symbol: 'BTC', venue: 'hyperliquid', leverage: 40, volume: '$1.70B Vol', price: 80772, change24h: 0.98 },
      { symbol: 'ETH', venue: 'hyperliquid', leverage: 25, volume: '$763.00M Vol', price: 2347.4, change24h: 1.32 },
      { symbol: 'HYPE', venue: 'hyperliquid', leverage: 10, volume: '$341.36M Vol', price: 81.192, change24h: 3.47, tile: t('#97FCE4', 'H', '#0B3B33') },
      { symbol: 'ZEC', venue: 'hyperliquid', leverage: 10, volume: '$262.94M Vol', price: 1298.7, change24h: 5.71, tile: t('#F4B728', 'Z', '#0B0B0B') },
      { symbol: 'SKHYNIX', venue: 'hyperliquid', leverage: 10, volume: '$250.83M Vol', price: 1032.8, change24h: 4.93, tile: t('#FFFFFF', 'S', '#E8590C') },
      { symbol: 'SP500', venue: 'hyperliquid', leverage: 50, volume: '$241.28M Vol', price: 7723.5, change24h: 0.63, tile: t('#E5252F', 'S&P') },
    ],
  },
  {
    key: 'new', title: 'New',
    markets: [
      { symbol: 'ANT', venue: 'aster', leverage: 10, volume: '$6.58M Vol', price: 115.36, change24h: 1.0, tile: t('#E9EAEE', 'ANT', '#B8BBC6') },
      { symbol: 'XTEN', venue: 'aster', leverage: 3, volume: '$2.22M Vol', price: 0.2667, change24h: 71.39, tile: t('#000000', 'X', '#19E68C') },
      { symbol: 'PREDICT', venue: 'aster', leverage: 10, volume: '$1.77M Vol', price: 1.4784, change24h: 2.39, tile: t('#5B3CF5', 'P') },
      { symbol: 'UNITREE', venue: 'aster', leverage: 20, volume: '$660.27K Vol', price: 93.952, change24h: -2.95, tile: t('#FFFFFF', 'U', '#222222') },
      { symbol: 'IOST', venue: 'aster', leverage: 10, volume: '$164.56K Vol', price: 0.0007844, change24h: 2.38, tile: t('#101010', 'I') },
    ],
  },
  {
    key: 'stocks', title: 'Stocks',
    markets: [
      { symbol: 'SNDK', venue: 'hyperliquid', leverage: 10, volume: '$152.27M Vol', price: 1310.5, change24h: 4.29, tile: t('#E5252F', 'S') },
      { symbol: 'SOXL', venue: 'hyperliquid', leverage: 10, volume: '$134.61M Vol', price: 101.52, change24h: 11.92, tile: t('#0B4EA2', 'D') },
      { symbol: 'SKHY', venue: 'hyperliquid', leverage: 10, volume: '$90.68M Vol', price: 145.81, change24h: 2.23, tile: t('#FFFFFF', 'S', '#E8590C') },
    ],
  },
  {
    key: 'crypto', title: 'Crypto',
    markets: [
      { symbol: 'BTC', venue: 'hyperliquid', leverage: 40, volume: '$1.74B Vol', price: 80843, change24h: 1.5 },
      { symbol: 'ETH', venue: 'hyperliquid', leverage: 25, volume: '$671.23M Vol', price: 2351.6, change24h: 2.05 },
      { symbol: 'HYPE', venue: 'hyperliquid', leverage: 10, volume: '$320.35M Vol', price: 81.133, change24h: 4.83, tile: t('#97FCE4', 'H', '#0B3B33') },
      { symbol: 'ZEC', venue: 'hyperliquid', leverage: 10, volume: '$263.26M Vol', price: 1306.8, change24h: 7.15, tile: t('#F4B728', 'Z', '#0B0B0B') },
      { symbol: 'NEAR', venue: 'hyperliquid', leverage: 10, volume: '$104.03M Vol', price: 4.6965, change24h: 6.32, tile: t('#111111', 'N') },
      { symbol: 'SOL', venue: 'hyperliquid', leverage: 20, volume: '$90.20M Vol', price: 101.97, change24h: 2.44, tile: t('#14F195', 'S', '#0B0B0B') },
      { symbol: 'XRP', venue: 'hyperliquid', leverage: 20, volume: '$77.54M Vol', price: 1.3262, change24h: 2.29, tile: t('#F2F2F2', 'X', '#111111') },
      { symbol: 'ENA', venue: 'hyperliquid', leverage: 10, volume: '$44.06M Vol', price: 0.2057, change24h: -1.1, tile: t('#111111', 'E') },
      { symbol: 'XMR', venue: 'hyperliquid', leverage: 5, volume: '$30.84M Vol', price: 613.41, change24h: 3.05, tile: t('#F26822', 'M') },
      { symbol: 'WLD', venue: 'hyperliquid', leverage: 10, volume: '$23.26M Vol', price: 0.4347, change24h: 0.01, tile: t('#F2F2F2', 'W', '#111111') },
    ],
  },
  {
    key: 'preipo', title: 'Pre-IPO',
    markets: [
      { symbol: 'ANTH', venue: 'aster', leverage: 15, volume: '$12.20M Vol', price: 1878.7, change24h: -0.73, tile: t('#D97757', 'A') },
      { symbol: 'ANT', venue: 'aster', leverage: 10, volume: '$8.04M Vol', price: 117.72, change24h: 1.96, tile: t('#E9EAEE', 'ANT', '#B8BBC6') },
      { symbol: 'OAI', venue: 'aster', leverage: 6, volume: '$2.23M Vol', price: 1515.2, change24h: 5.73, tile: t('#101010', 'O') },
      { symbol: 'PREDICT', venue: 'aster', leverage: 10, volume: '$2.02M Vol', price: 1.6977, change24h: 19.32, tile: t('#5B3CF5', 'P') },
      { symbol: 'MOONSHOT', venue: 'aster', leverage: 20, volume: '$313.51K Vol', price: 64.23, change24h: 1.01, tile: t('#14213D', 'M') },
      { symbol: 'PAPER', venue: 'aster', leverage: 3, volume: '$126.41K Vol', price: 0.02483, change24h: -6.69, tile: t('#F5EFE6', 'P', '#6B5B3E') },
      { symbol: 'XTEN', venue: 'aster', leverage: 5, volume: '$79.67K Vol', price: 0.2543, change24h: -6.82, tile: t('#000000', 'X', '#19E68C') },
      { symbol: 'POLYMARKET', venue: 'aster', leverage: 5, volume: '$16.53K Vol', price: 21.456, change24h: -0.04, tile: t('#2E5AAC', 'PM') },
      { symbol: 'OURA', venue: 'aster', leverage: 5, volume: '$6.58K Vol', price: 48.546, change24h: 0.39, tile: t('#B4432C', 'O') },
    ],
  },
  {
    key: 'commodities', title: 'Commodities',
    markets: [
      { symbol: 'CL', venue: 'aster', leverage: 20, volume: '$231.14M Vol', price: 101.48, change24h: -0.85, tile: t('#101010', 'CL') },
      { symbol: 'BRENTOIL', venue: 'aster', leverage: 20, volume: '$112.23M Vol', price: 111.0, change24h: -0.28, tile: t('#4A3728', 'B') },
      { symbol: 'SILVER', venue: 'aster', leverage: 25, volume: '$58.24M Vol', price: 53.986, change24h: 1.91, tile: t('#C9CDD6', 'Ag', '#333A48') },
      { symbol: 'GOLD', venue: 'aster', leverage: 25, volume: '$37.54M Vol', price: 4047.2, change24h: 1.18, tile: t('#E0B030', 'Au', '#3A2A00') },
      { symbol: 'NATGAS', venue: 'aster', leverage: 10, volume: '$6.57M Vol', price: 3.0532, change24h: -0.03, tile: t('#1B6CA8', 'NG') },
      { symbol: 'PLATINUM', venue: 'aster', leverage: 20, volume: '$3.97M Vol', price: 1539.5, change24h: 2.86, tile: t('#DDE1E6', 'Pt', '#3C4148') },
      { symbol: 'COPPER', venue: 'aster', leverage: 20, volume: '$3.96M Vol', price: 6.648, change24h: 1.13, tile: t('#B87333', 'Cu', '#2E1B0E') },
      { symbol: 'PALLADIUM', venue: 'aster', leverage: 20, volume: '$835.35K Vol', price: 1030.7, change24h: 0.43, tile: t('#E3E8EF', 'Pd', '#424750') },
      { symbol: 'BZ', venue: 'aster', leverage: 50, volume: '$715.76K Vol', price: 111.05, change24h: -0.31, tile: t('#3D5A3C', 'BZ') },
      { symbol: 'HO', venue: 'aster', leverage: 10, volume: '$512.12K Vol', price: 4.6098, change24h: -3.23, tile: t('#7A3B2E', 'HO') },
    ],
  },
  {
    key: 'fx', title: 'FX',
    markets: [
      { symbol: 'EUR', venue: 'hyperliquid', leverage: 50, volume: '$2.36M Vol', price: 1.1123, change24h: -0.4, tile: t('#1B4FB5', 'EU') },
      { symbol: 'JPY', venue: 'hyperliquid', leverage: 50, volume: '$1.95M Vol', price: 157.85, change24h: 0.07, tile: t('#FFFFFF', '●', '#E5252F') },
      { symbol: 'GBP', venue: 'hyperliquid', leverage: 50, volume: '$75.44K Vol', price: 1.3276, change24h: -0.35, tile: t('#1B3F8F', 'GB') },
    ],
  },
  {
    key: 'meme', title: 'Meme',
    markets: [
      { symbol: 'BULLA', venue: 'aster', leverage: 5, volume: '$13.41M Vol', price: 0.06691, change24h: -57.17, tile: t('#D9B99B', 'B', '#3A2A1A') },
      { symbol: 'kPEPE', venue: 'aster', leverage: 10, volume: '$9.55M Vol', price: 0.004536, change24h: 5.19, tile: t('#4F9A3D', 'P') },
      { symbol: 'CASHCAT', venue: 'aster', leverage: 3, volume: '$6.09M Vol', price: 0.09853, change24h: 8.2, tile: t('#E9EAEE', 'C', '#555A66') },
      { symbol: 'FARTCOIN', venue: 'aster', leverage: 10, volume: '$4.48M Vol', price: 0.1306, change24h: 2.74, tile: t('#101010', 'F') },
      { symbol: 'DOGE', venue: 'hyperliquid', leverage: 10, volume: '$4.45M Vol', price: 0.07842, change24h: 1.54, tile: t('#C2A633', 'D') },
      { symbol: 'TRUMP', venue: 'hyperliquid', leverage: 10, volume: '$2.21M Vol', price: 1.6944, change24h: -0.34, tile: t('#F2F2F2', 'T', '#222222') },
    ],
  },
];

/** Price with Trust-style precision: 5 sig figs for sub-$1, 1 decimal for 4-figure+, 3 otherwise. */
export function formatPerpPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  if (p >= 100) return `$${p.toFixed(2)}`;
  if (p >= 10) return `$${p.toFixed(3)}`;
  if (p >= 1) return `$${p.toFixed(4)}`;
  if (p >= 0.01) return `$${p.toFixed(5)}`;
  return `$${p.toFixed(7)}`;
}

export function formatChange(c: number): string {
  return `${c >= 0 ? '+' : ''}${c.toFixed(2)}%`;
}

/** Deterministic sparkline that ends up/down with the 24h change. */
export function perpSpark(symbol: string, change: number, n = 28): number[] {
  let h = 7;
  for (let i = 0; i < symbol.length; i++) h = (h * 33 + symbol.charCodeAt(i)) % 2147483647;
  const out: number[] = [];
  let v = 50;
  const drift = change >= 0 ? 0.55 : -0.55;
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) % 2147483648;
    v += ((h / 2147483648) - 0.5) * 7 + drift;
    out.push(Number(v.toFixed(2)));
  }
  return out;
}
