/**
 * Veltravia Wallet — wallet accounts context.
 *
 * Owns the list of WalletAccounts and which one is active. Persisted as a
 * JSON blob via react-native-keychain (encrypted at rest). The default
 * "Veltravia Wallet" account is created on first launch so the home header
 * pill always has something to show.
 *
 * Phase 2 (Wallet Core): key material, addresses and real backup state
 * attach to these records; until then `backedUp` is bookkeeping for the
 * "Back up your wallet" nudge, and creation is metadata-only.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as Keychain from 'react-native-keychain';
import type { WalletAccount } from './types';

const STORAGE_SERVICE = 'com.veltravia.wallet.accounts';

export const DEFAULT_WALLET: WalletAccount = {
  id: 'wallet-veltravia',
  name: 'Veltravia Wallet',
  color: 'veltravia',
  icon: 'veltravia',
  active: true,
  backedUp: false,
  createdAt: 0,
  origin: 'default',
};

interface WalletsContextValue {
  wallets: WalletAccount[];
  activeWallet: WalletAccount;
  /** True once the persisted list (or the default) has loaded. */
  ready: boolean;
  /** Next unused "Wallet N" name, like Trust Wallet. */
  nextWalletName: () => string;
  createWallet: (name: string, icon: string, color: string, origin: 'created' | 'imported') => WalletAccount;
  switchWallet: (id: string) => void;
}

const WalletsContext = createContext<WalletsContextValue | null>(null);

export function WalletsProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<WalletAccount[]>([DEFAULT_WALLET]);
  const [ready, setReady] = useState(false);

  // -- load / persist ------------------------------------------------------

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const creds = await Keychain.getGenericPassword({ service: STORAGE_SERVICE });
        if (creds && typeof creds.password === 'string') {
          const parsed = JSON.parse(creds.password) as WalletAccount[];
          if (Array.isArray(parsed) && parsed.length > 0 && alive) {
            // Guarantee exactly one active wallet.
            const withActive = parsed.some((w) => w.active)
              ? parsed.map((w) => ({ ...w, active: !!w.active }))
              : parsed.map((w, i) => ({ ...w, active: i === 0 }));
            setWallets(withActive);
          }
        }
      } catch {
        // Keychain unavailable (fresh install, device locked): keep default.
      }
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback((next: WalletAccount[]) => {
    setWallets(next);
    Keychain.setGenericPassword(STORAGE_SERVICE, JSON.stringify(next), {
      service: STORAGE_SERVICE,
    }).catch(() => undefined);
  }, []);

  // -- helpers -------------------------------------------------------------

  const nextWalletName = useCallback(() => {
    const numbers = wallets
      .filter((w) => w.origin !== 'default')
      .map((w) => /^Wallet (\d+)$/.exec(w.name)?.[1])
      .filter(Boolean)
      .map(Number);
    const n = numbers.length ? Math.max(...numbers) + 1 : wallets.filter((w) => w.origin !== 'default').length + 2;
    return `Wallet ${Math.max(2, n)}`;
  }, [wallets]);

  const createWallet = useCallback(
    (name: string, icon: string, color: string, origin: 'created' | 'imported') => {
      const account: WalletAccount = {
        id: `wallet-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        name: name.trim() || nextWalletName(),
        icon,
        color,
        active: true,
        backedUp: false,
        createdAt: Date.now(),
        origin,
      };
      persist(wallets.map((w) => ({ ...w, active: false })).concat(account));
      return account;
    },
    [wallets, nextWalletName, persist],
  );

  const switchWallet = useCallback(
    (id: string) => {
      if (!wallets.some((w) => w.id === id && w.active)) {
        persist(wallets.map((w) => ({ ...w, active: w.id === id })));
      }
    },
    [wallets, persist],
  );

  const activeWallet = wallets.find((w) => w.active) ?? wallets[0];

  return (
    <WalletsContext.Provider
      value={{ wallets, activeWallet, ready, nextWalletName, createWallet, switchWallet }}
    >
      {children}
    </WalletsContext.Provider>
  );
}

export function useWallets(): WalletsContextValue {
  const ctx = useContext(WalletsContext);
  if (!ctx) throw new Error('useWallets must be used inside WalletsProvider');
  return ctx;
}
