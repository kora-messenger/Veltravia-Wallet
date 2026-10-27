/**
 * Veltravia Wallet — asset + network catalog.
 * One source of truth for Manage crypto, Select network and the chip strip.
 * Backend (api.veltraviawallet.com) replaces this list in a later phase.
 */
export interface Network {
  id: string;
  name: string;
  /** brand color of the network tile (used by the generic mark) */
  color: string;
  /** short mark text when there is no dedicated logo */
  mark: string;
  dark?: boolean; // light mark on dark tile
}
export interface CatalogAsset {
  symbol: string;
  name: string;      // chip next to the ticker ("Bitcoin", "BNB Smart Chain")
  fullName: string;  // grey second line
  network: string;   // Network.id
  color: string;
  mark?: string;
}

export const NETWORKS: Network[] = [
  { id: 'bitcoin', name: 'Bitcoin', color: '#F7931A', mark: 'B' },
  { id: 'ethereum', name: 'Ethereum', color: '#627EEA', mark: 'E' },
  { id: 'solana', name: 'Solana', color: '#14151F', mark: 'S', dark: true },
  { id: 'bsc', name: 'BNB Smart Chain', color: '#0B0B0B', mark: 'B', dark: true },
  { id: 'tron', name: 'Tron', color: '#E8112D', mark: 'T' },
  { id: 'arbitrum', name: 'Arbitrum', color: '#2D374B', mark: 'A' },
  { id: 'base', name: 'Base', color: '#0000FF', mark: '' },
  { id: 'robinhood', name: 'Robinhood Chain', color: '#CCFF00', mark: 'R' },
  { id: 'optimism', name: 'OP Mainnet', color: '#FF0420', mark: 'O' },
  { id: 'polygon', name: 'Polygon', color: '#8247E5', mark: 'P' },
  { id: 'avalanche', name: 'Avalanche C-Chain', color: '#E84142', mark: 'A' },
  { id: 'cardano', name: 'Cardano', color: '#0033AD', mark: 'A' },
  { id: 'dogecoin', name: 'Dogecoin', color: '#C2A633', mark: 'D' },
  { id: 'ripple', name: 'XRP Ledger', color: '#14151F', mark: 'X', dark: true },
  { id: 'stellar', name: 'Stellar', color: '#14151F', mark: 'S', dark: true },
  { id: 'cosmos', name: 'Cosmos Hub', color: '#2E3148', mark: 'C', dark: true },
  { id: 'celo', name: 'Celo', color: '#FCFF52', mark: 'C' },
  { id: 'algorand', name: 'Algorand', color: '#14151F', mark: 'A', dark: true },
];

export const ASSETS: CatalogAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin', fullName: 'Bitcoin', network: 'bitcoin', color: '#F7931A' },
  { symbol: 'ETH', name: 'Ethereum', fullName: 'Ethereum', network: 'ethereum', color: '#627EEA' },
  { symbol: 'XRP', name: 'XRP', fullName: 'XRP', network: 'ripple', color: '#14151F' },
  { symbol: 'BNB', name: 'BNB Smart Chain', fullName: 'BNB', network: 'bsc', color: '#0B0B0B' },
  { symbol: 'SOL', name: 'Solana', fullName: 'Solana', network: 'solana', color: '#14151F' },
  { symbol: 'DOGE', name: 'Dogecoin', fullName: 'Dogecoin', network: 'dogecoin', color: '#C2A633' },
  { symbol: 'ADA', name: 'Cardano', fullName: 'Cardano', network: 'cardano', color: '#0033AD' },
  { symbol: 'TRX', name: 'Tron', fullName: 'Tron', network: 'tron', color: '#E8112D' },
  { symbol: 'AVAX', name: 'Avalanche C-Chain', fullName: 'Avalanche', network: 'avalanche', color: '#E84142' },
  { symbol: 'XLM', name: 'Stellar', fullName: 'Stellar', network: 'stellar', color: '#14151F' },
  { symbol: 'USDT', name: 'Ethereum', fullName: 'Tether', network: 'ethereum', color: '#26A17B' },
  { symbol: 'USDT', name: 'BNB Smart Chain', fullName: 'Tether', network: 'bsc', color: '#26A17B' },
  { symbol: 'MATIC', name: 'Polygon', fullName: 'Polygon', network: 'polygon', color: '#8247E5' },
  { symbol: 'ARB', name: 'Arbitrum', fullName: 'Arbitrum', network: 'arbitrum', color: '#2D374B' },
  { symbol: 'OP', name: 'OP Mainnet', fullName: 'Optimism', network: 'optimism', color: '#FF0420' },
  { symbol: 'ATOM', name: 'Cosmos Hub', fullName: 'Cosmos', network: 'cosmos', color: '#2E3148' },
  { symbol: 'ALGO', name: 'Algorand', fullName: 'Algorand', network: 'algorand', color: '#14151F' },
  { symbol: 'CELO', name: 'Celo', fullName: 'Celo', network: 'celo', color: '#FCFF52' },
];

/** Assets enabled by default (matches Trust's fresh wallet: BTC + ETH on). */
export const DEFAULT_ENABLED = ['BTC:bitcoin', 'ETH:ethereum'];
export const assetKey = (a: CatalogAsset) => `${a.symbol}:${a.network}`;
