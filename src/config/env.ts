/**
 * Veltravia Wallet — environment contract.
 *
 * RULES (do not break):
 *  1. No component, service or screen may hardcode a URL, chain id or flag.
 *     Everything routes through this module.
 *  2. The base URLs come from build-time env vars (.env / CI secrets), which
 *     makes the backend domain swappable without touching code — the same
 *     pattern Trust Wallet uses for its gateways.
 *  3. Adding an environment = adding an .env file, nothing else.
 */

export type BuildEnv = 'development' | 'staging' | 'production';

interface EnvConfig {
  env: BuildEnv;
  API_BASE_URL: string;
  WS_BASE_URL: string;
  EXPLORER_TEMPLATE: Record<string, string>;
}

// react-native-config reads from .env files at build time.
import { Config } from 'react-native-config';

const ENV: Record<BuildEnv, Omit<EnvConfig, 'env'>> = {
  development: {
    API_BASE_URL: Config.API_BASE_URL ?? 'https://api.dev.veltravia.app',
    WS_BASE_URL: Config.WS_BASE_URL ?? 'wss://stream.dev.veltravia.app',
    EXPLORER_TEMPLATE: {
      '1': 'https://sepolia.etherscan.io/tx/{hash}',
      '97': 'https://testnet.bscscan.com/tx/{hash}',
      '80002': 'https://amoy.polygonscan.com/tx/{hash}',
    },
  },
  staging: {
    API_BASE_URL: Config.API_BASE_URL ?? 'https://api.stg.veltravia.app',
    WS_BASE_URL: Config.WS_BASE_URL ?? 'wss://stream.stg.veltravia.app',
    EXPLORER_TEMPLATE: {
      '1': 'https://sepolia.etherscan.io/tx/{hash}',
      '97': 'https://testnet.bscscan.com/tx/{hash}',
      '80002': 'https://amoy.polygonscan.com/tx/{hash}',
    },
  },
  production: {
    API_BASE_URL: Config.API_BASE_URL ?? 'https://api.veltravia.app',
    WS_BASE_URL: Config.WS_BASE_URL ?? 'wss://stream.veltravia.app',
    EXPLORER_TEMPLATE: {
      '1': 'https://etherscan.io/tx/{hash}',
      '56': 'https://bscscan.com/tx/{hash}',
      '137': 'https://polygonscan.com/tx/{hash}',
    },
  },
};

const env: BuildEnv = (Config.ENV as BuildEnv) ?? 'development';

export const APP_CONFIG: EnvConfig = { env, ...ENV[env] };

/** Is the app running against testnet or mainnet? Derived, never hardcoded. */
export const IS_TESTNET = env !== 'production';

export function explorerUrl(chainId: string, txHash: string): string {
  const template = APP_CONFIG.EXPLORER_TEMPLATE[chainId];
  if (!template) {
    throw new Error(`No explorer template for chainId ${chainId}`);
  }
  return template.replace('{hash}', txHash);
}
