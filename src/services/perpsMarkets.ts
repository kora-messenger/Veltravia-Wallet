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
      { symbol: 'BTC', leverage: 40, volume: '$1.70B Vol', price: 80772, change24h: 0.98 },
      { symbol: 'ETH', leverage: 25, volume: '$763.00M Vol', price: 2347.4, change24h: 1.32 },
      { symbol: 'HYPE', leverage: 10, volume: '$341.36M Vol', price: 81.192, change24h: 3.47, tile: t('#97FCE4', 'H', '#0B3B33') },
      { symbol: 'ZEC', leverage: 10, volume: '$262.94M Vol', price: 1298.7, change24h: 5.71, tile: t('#F4B728', 'Z', '#0B0B0B') },
      { symbol: 'SKHYNIX', leverage: 10, volume: '$250.83M Vol', price: 1032.8, change24h: 4.93, tile: t('#FFFFFF', 'S', '#E8590C') },
      { symbol: 'SP500', leverage: 50, volume: '$241.28M Vol', price: 7723.5, change24h: 0.63, tile: t('#E5252F', 'S&P') },
    ],
  },
  {
    key: 'new', title: 'New',
    markets: [
      { symbol: 'ANT', leverage: 10, volume: '$6.58M Vol', price: 115.36, change24h: 1.0, tile: t('#E9EAEE', 'ANT', '#B8BBC6') },
      { symbol: 'XTEN', leverage: 3, volume: '$2.22M Vol', price: 0.2667, change24h: 71.39, tile: t('#000000', 'X', '#19E68C') },
      { symbol: 'PREDICT', leverage: 10, volume: '$1.77M Vol', price: 1.4784, change24h: 2.39, tile: t('#5B3CF5', 'P') },
      { symbol: 'UNITREE', leverage: 20, volume: '$660.27K Vol', price: 93.952, change24h: -2.95, tile: t('#FFFFFF', 'U', '#222222') },
      { symbol: 'IOST', leverage: 10, volume: '$164.56K Vol', price: 0.0007844, change24h: 2.38, tile: t('#101010', 'I') },
    ],
  },
  {
    key: 'crypto', title: 'Crypto',
    markets: [
      { symbol: 'BTC', leverage: 40, volume: '$1.70B Vol', price: 80786, change24h: 1.0 },
      { symbol: 'ETH', leverage: 25, volume: '$763.00M Vol', price: 2348.6, change24h: 1.37 },
      { symbol: 'HYPE', leverage: 10, volume: '$341.36M Vol', price: 81.269, change24h: 3.57, tile: t('#97FCE4', 'H', '#0B3B33') },
      { symbol: 'ZEC', leverage: 10, volume: '$262.94M Vol', price: 1300.4, change24h: 5.84, tile: t('#F4B728', 'Z', '#0B0B0B') },
      { symbol: 'NEAR', leverage: 10, volume: '$100.90M Vol', price: 4.6403, change24h: 3.62, tile: t('#111111', 'N') },
    ],
  },
  {
    key: 'stocks', title: 'Stocks',
    markets: [
      { symbol: 'SNDK', leverage: 10, volume: '$152.27M Vol', price: 1310.5, change24h: 4.29, tile: t('#E5252F', 'S') },
      { symbol: 'SOXL', leverage: 10, volume: '$134.61M Vol', price: 101.52, change24h: 11.92, tile: t('#0B4EA2', 'D') },
      { symbol: 'SKHY', leverage: 10, volume: '$90.68M Vol', price: 145.81, change24h: 2.23, tile: t('#FFFFFF', 'S', '#E8590C') },
    ],
  },
  {
    key: 'forex', title: 'Forex',
    markets: [
      { symbol: 'JPY', leverage: 50, volume: '$1.79M Vol', price: 157.85, change24h: 0.26, tile: t('#FFFFFF', '●', '#E5252F') },
      { symbol: 'GBP', leverage: 50, volume: '$55.01K Vol', price: 1.3311, change24h: -0.25, tile: t('#1B3F8F', 'GB') },
    ],
  },
  {
    key: 'meme', title: 'Meme',
    markets: [
      { symbol: 'BULLA', leverage: 5, volume: '$13.41M Vol', price: 0.06691, change24h: -57.17, tile: t('#D9B99B', 'B', '#3A2A1A') },
      { symbol: 'kPEPE', leverage: 10, volume: '$9.55M Vol', price: 0.004536, change24h: 5.19, tile: t('#4F9A3D', 'P') },
      { symbol: 'CASHCAT', leverage: 3, volume: '$6.09M Vol', price: 0.09853, change24h: 8.2, tile: t('#E9EAEE', 'C', '#555A66') },
      { symbol: 'FARTCOIN', leverage: 10, volume: '$4.48M Vol', price: 0.1306, change24h: 2.74, tile: t('#101010', 'F') },
      { symbol: 'DOGE', leverage: 10, volume: '$4.45M Vol', price: 0.07842, change24h: 1.54, tile: t('#C2A633', 'D') },
      { symbol: 'TRUMP', leverage: 10, volume: '$2.21M Vol', price: 1.6944, change24h: -0.34, tile: t('#F2F2F2', 'T', '#222222') },
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
