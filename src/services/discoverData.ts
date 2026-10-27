/**
 * Veltravia Wallet — Discover data (Phase 1: local dataset).
 *
 * Shapes are final. `searchDiscover` simulates the network round-trip and is
 * the single swap point for api.veltraviawallet.com (trending / search). The
 * screen only ever talks to this module, so going live touches one file.
 */

export type DiscoverChain = 'eth' | 'bnb' | 'sol' | 'base' | 'poly';

export interface TrendingToken {
  id: string;
  symbol: string;
  name: string;
  chain: DiscoverChain;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  /** Brand tint for the avatar disc (logo art ships with the real feed). */
  color: string;
}

export interface Dapp {
  id: string;
  name: string;
  category: string;
  /** One-liner shown under the name, like Trust's dApp feed. */
  description: string;
  color: string;
  url: string;
}

export interface Prediction {
  id: string;
  title: string;
  volume: number;
}

export const CHAIN_LABEL: Record<DiscoverChain, string> = {
  eth: 'Ethereum', bnb: 'BNB Chain', sol: 'Solana', base: 'Base', poly: 'Polygon',
};
export const CHAIN_COLOR: Record<DiscoverChain, string> = {
  eth: '#627EEA', bnb: '#F3BA2F', sol: '#9945FF', base: '#0052FF', poly: '#8247E5',
};

export const TRENDING_TOKENS: TrendingToken[] = [
  { id: 'whype', symbol: 'WHYPE', name: 'Wrapped HYPE', chain: 'eth', priceUsd: 78.07, change24h: 2.4, volume24h: 58_410_000, color: '#0F3D3A' },
  { id: 'ain', symbol: 'AIN', name: 'Infinity Ground', chain: 'bnb', priceUsd: 0.137, change24h: 243.25, volume24h: 23_590_000, color: '#111111' },
  { id: 'btc-meme', symbol: 'BTC', name: 'Big Titty Coin', chain: 'base', priceUsd: 0.026, change24h: 35.02, volume24h: 18_000_000, color: '#1B1B1B' },
  { id: 'stonk', symbol: 'STONK', name: 'STONK (stonkfun.xyz)', chain: 'sol', priceUsd: 0.1293, change24h: -1.28, volume24h: 13_900_000, color: '#14323A' },
  { id: 'pons', symbol: 'PONS', name: 'Pons', chain: 'base', priceUsd: 0.2476, change24h: 6.69, volume24h: 9_130_000, color: '#C9CDC9' },
  { id: 'launch-sol', symbol: 'LAUNCH', name: 'Launch', chain: 'sol', priceUsd: 0.0024, change24h: -9.99, volume24h: 8_570_000, color: '#10222C' },
  { id: 'uni', symbol: 'UNI', name: 'Uniswap', chain: 'eth', priceUsd: 7.04, change24h: 1.97, volume24h: 7_870_000, color: '#FF007A' },
  { id: 'dood', symbol: 'DOOD', name: 'Doodles', chain: 'bnb', priceUsd: 0.0022, change24h: 13.57, volume24h: 6_770_000, color: '#F5A8D0' },
  { id: 'launch-bnb', symbol: 'LAUNCH', name: 'Launch', chain: 'bnb', priceUsd: 0.0655, change24h: 17260, volume24h: 6_700_000, color: '#10222C' },
  { id: 'elon2028', symbol: 'ELON2028', name: 'Elon 2028', chain: 'sol', priceUsd: 0.000477, change24h: 15835.26, volume24h: 6_060_000, color: '#1A2A55' },
  { id: 'dogelon', symbol: 'ELON', name: 'Dogelon', chain: 'eth', priceUsd: 0.00000002672, change24h: -0.25, volume24h: 14_200, color: '#F2A24B' },
];

export const DAPPS: Dapp[] = [
  { id: 'uniswap', name: 'Uniswap', category: 'DEX', color: '#FF007A', url: 'https://app.uniswap.org', description: 'The leading decentralized exchange on Ethereum. Swap tokens and provide liquidity.' },
  { id: 'pancake', name: 'PancakeSwap', category: 'DEX', color: '#1FC7D4', url: 'https://pancakeswap.finance', description: 'Trade, earn and win crypto on BNB Chain. Low-fee swaps and syrup farms.' },
  { id: 'aave', name: 'Aave', category: 'Lending', color: '#B6509E', url: 'https://app.aave.com', description: 'Deposit and borrow across 30+ assets with algorithmic money markets.' },
  { id: 'opensea', name: 'OpenSea', category: 'NFT Marketplace', color: '#2081E2', url: 'https://opensea.io', description: 'Discover, collect and sell NFTs across 200+ collections.' },
  { id: 'lido', name: 'Lido', category: 'Staking', color: '#00A3FF', url: 'https://stake.lido.fi', description: 'Liquid staking for Ethereum and Polygon. Daily rewards without lock-ups.' },
  { id: 'curve', name: 'Curve', category: 'DEX', color: '#3B5BDB', url: 'https://curve.fi', description: 'Deep-liquidity stablecoin exchange with low slippage and yield.' },
  { id: 'jupiter', name: 'Jupiter', category: 'DEX Aggregator', color: '#19B87A', url: 'https://jup.ag', description: 'The best price for Solana swaps, aggregated across all routes.' },
  { id: 'compound', name: 'Compound', category: 'Lending', color: '#00D395', url: 'https://app.compound.finance', description: 'Supply assets to earn interest or borrow against your balance.' },
  { id: 'echelon-market', name: 'Echelon Market', category: 'Lending', color: '#7ED6E6', url: 'https://echelon.market', description: 'A lending market for stables and RWAs with looping strategies.' },
  { id: 'echelon-bridge', name: 'Echelon Initia Bridge', category: 'Bridge', color: '#9AA0B5', url: 'https://echelon.market/bridge', description: 'Bridge assets between Initia and other chains in one click.' },
  { id: 'echelon-prime', name: 'Echelon Prime', category: 'Games', color: '#111111', url: 'https://echelonprime.com', description: 'A play-to-earn gaming ecosystem with tradable rewards.' },
  { id: 'stargate', name: 'Stargate', category: 'Bridge', color: '#6B6F85', url: 'https://stargate.finance', description: 'Move assets across chains with unified liquidity and instant finality.' },
];

const PREDICTIONS: Prediction[] = [
  { id: 'p1', title: 'Will Elon Musk rejoin the Trump Administration before 2027?', volume: 222.79 },
  { id: 'p2', title: 'Will Tesla sell a Cybercab for 30k or less this year?', volume: 201.87 },
  { id: 'p3', title: 'Elon Musk Net Worth on October 31?', volume: 138.74 },
  { id: 'p4', title: 'Will Ethereum reach $5,000 by December 31?', volume: 912.4 },
  { id: 'p5', title: 'Will Bitcoin close above $70k this month?', volume: 1450.2 },
];

export interface DiscoverSearchResult {
  tokens: TrendingToken[];
  predictions: Prediction[];
  dapps: Dapp[];
}

/** Network latency of the simulated gateway. Real API replaces this wholesale. */
const LATENCY_MS = 900;

/**
 * Search tokens, predictions and dApps. Resolves after a network-like delay
 * so the screen's loading skeleton is exercised exactly as it will be live.
 * Rejects only if `signal.cancelled` flips (a newer query superseded this one).
 */
export function searchDiscover(query: string, signal: { cancelled: boolean }): Promise<DiscoverSearchResult> {
  const q = query.trim().toLowerCase();
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (signal.cancelled) return reject(new Error('cancelled'));
      resolve({
        tokens: TRENDING_TOKENS.filter((t) => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q)),
        predictions: PREDICTIONS.filter((p) => p.title.toLowerCase().includes(q)),
        dapps: DAPPS.filter((d) => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)),
      });
    }, LATENCY_MS);
  });
}

/* ---- formatting ------------------------------------------------------- */

export function fmtPrice(p: number): string {
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return '$' + p.toFixed(2);
  if (p >= 0.001) return '$' + p.toFixed(4);
  if (p >= 0.0001) return '$' + p.toFixed(6);
  // sub-0.0001: Trust writes $0.0₇2672 (subscript zero count)
  const s = p.toFixed(14).replace(/0+$/, '');
  const frac = s.split('.')[1] ?? '';
  const zeros = frac.match(/^0*/)?.[0].length ?? 0;
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  const sub = String(zeros).split('').map((d) => subs[+d]).join('');
  return `$0.0${sub}${frac.slice(zeros, zeros + 4)}`;
}

export function fmtVol(v: number): string {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B Vol';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M Vol';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(2) + 'K Vol';
  return '$' + v.toFixed(2) + ' Vol';
}

export function fmtChange(c: number): string {
  return (c >= 0 ? '+' : '') + c.toFixed(2) + '%';
}
