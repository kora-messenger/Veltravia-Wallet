/**
 * Veltravia Wallet — backend client.
 *
 * The ONLY place the app talks to our backend. Domain comes from env config,
 * so pointing the app at a new backend (staging, prod, or Ijezie's own .com
 * infrastructure later) is a build-variable change, not a code change.
 *
 * Endpoints (v1):
 *   GET  /v1/prices           — token prices + 24h change
 *   GET  /v1/balances/:addr    — balances per chain
 *   GET  /v1/transactions/:addr — indexed history
 *   POST /v1/relay             — signed transaction broadcast
 *   WS   /v1/ai/stream         — hosted AI assistant (WebSocket streaming)
 */

import { APP_CONFIG, IS_TESTNET } from '../config/env';

export interface TokenPrice {
  symbol: string;
  chainId: string;
  priceUsd: number;
  change24h: number;
}

export interface TokenBalance {
  chainId: string;
  contractAddress: string | null;
  symbol: string;
  decimals: number;
  amountRaw: string; // bigint as string — never float money
}

export interface TransactionRecord {
  hash: string;
  chainId: string;
  from: string;
  to: string;
  amountRaw: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${APP_CONFIG.API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Veltravia-Env': APP_CONFIG.env,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  prices(): Promise<TokenPrice[]> {
    return request<TokenPrice[]>('/v1/prices');
  },

  balances(address: string): Promise<TokenBalance[]> {
    return request<TokenBalance[]>(`/v1/balances/${encodeURIComponent(address)}`);
  },

  transactions(address: string): Promise<TransactionRecord[]> {
    return request<TransactionRecord[]>(
      `/v1/transactions/${encodeURIComponent(address)}`
    );
  },

  /** Broadcast an already-signed transaction (we never sign server-side). */
  relay(chainId: string, signedTxHex: string): Promise<{ hash: string }> {
    return request<{ hash: string }>('/v1/relay', {
      method: 'POST',
      body: JSON.stringify({ chainId, signedTxHex, testnet: IS_TESTNET }),
    });
  },
};
