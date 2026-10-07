/**
 * Veltravia Wallet — chain registry.
 *
 * v1 scope: EVM trio (Ethereum, BNB Smart Chain, Polygon). Bitcoin ships in
 * the second wave via the same interface — UTXO chains are a WalletCore
 * concern, not a UI concern, which is why the registry is data, not code.
 *
 * TESTNET-FIRST POLICY:
 *   The app builds against testnet RPCs. Flipping to mainnet means changing
 *   nothing here — only the ENV in .env / CI secrets switches the explorer
 *   templates, and this table already carries both RPC sets.
 */

export interface ChainConfig {
  id: string; // CAIP-2-ish numeric chain id, used as key everywhere
  name: string;
  symbol: string;
  decimals: number;
  rpcUrlTestnet: string;
  rpcUrlMainnet: string;
  gradient: [string, string]; // token badge background
}

export const CHAINS: ChainConfig[] = [
  {
    id: '1',
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    rpcUrlTestnet: 'https://ethereum-sepolia-rpc.publicnode.com',
    rpcUrlMainnet: 'https://eth.llamarpc.com',
    gradient: ['#627EEA', '#8CA6F8'],
  },
  {
    id: '56',
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    decimals: 18,
    rpcUrlTestnet: 'https://bsc-testnet-rpc.publicnode.com',
    rpcUrlMainnet: 'https://bsc-dataseed.binance.org',
    gradient: ['#F0B90B', '#F8D33A'],
  },
  {
    id: '137',
    name: 'Polygon',
    symbol: 'POL',
    decimals: 18,
    rpcUrlTestnet: 'https://rpc-amoy.polygon.technology',
    rpcUrlMainnet: 'https://polygon-rpc.com',
    gradient: ['#8247E5', '#A684FF'],
  },
];

export function chainById(id: string): ChainConfig {
  const chain = CHAINS.find((c) => c.id === id);
  if (!chain) throw new Error(`Unknown chain id: ${id}`);
  return chain;
}

export function rpcUrl(chain: ChainConfig, mainnet: boolean): string {
  return mainnet ? chain.rpcUrlMainnet : chain.rpcUrlTestnet;
}
