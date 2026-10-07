/**
 * Veltravia Wallet — wallet manager.
 *
 * Thin, mockable facade over Trust Wallet Core (C++ via JNI). Every crypto
 * operation flows through here so that:
 *  - the UI layer contains zero cryptography
 *  - unit tests can swap the real engine for a deterministic fake
 *  - WalletCore stays an implementation detail we can upgrade in isolation
 *
 * WalletCore is consumed as a prebuilt artifact:
 *    implementation("com.trustwallet:wallet-core:<version>")
 * resolved from GitHub Packages (a read token is injected in CI and in
 * android/gradle.properties for local builds).
 *
 * SEED HANDLING RULE: the mnemonic string exists only inside secureStorage
 * and inside WalletCore's StoredKey. This module never returns it.
 */

import * as SecureStorage from '../storage/secureStorage';
import { CHAINS } from '../../config/chains';

// Types mirror WalletCore's TW* objects — the native module surface.
interface WalletCoreNative {
  // StoredKey: encrypted seed container (file lives in app-private storage)
  StoredKeyImportPhrase(phrase: string, name: string, password: string): string; // returns StoredKey handle
  StoredKeyExportPhrase(handle: number, password: string): string;
  StoredKeyAccount(
    handle: string,
    password: string,
    coinType: number,
    derivationPath: string
  ): number; // returns HDWallet handle

  // HDWallet: derivation
  HDWalletGetAddressForCoin(handle: number, coinType: number): string;
  HDWalletGetAddressDerivation(
    handle: number,
    coinType: number,
    derivationPath: string
  ): string;

  // Mnemonic generation for new wallets
  HDWalletCreateMnemonic(strength: number): string;
  HDWalletMnemonicIsValid(phrase: string): boolean;
}

// Populated by the native bridge module (android/src/main/java/...).
declare global {
  var __WalletCore: WalletCoreNative | undefined;
}

function core(): WalletCoreNative {
  const native = globalThis.__WalletCore;
  if (!native) {
    throw new Error('WalletCore native bridge not initialized');
  }
  return native;
}

/** BIP44 coin types for v1 chains (WalletCore enums). */
const COIN_TYPE = { ETHEREUM: 60, BINANCE: 20000714, POLYGON: 966 } as const;

const DEFAULT_PATH = "m/44'/60'/0'/0/0";

export interface WalletAccount {
  chainId: string;
  address: string;
}

export class WalletManager {
  /**
   * Create a brand-new wallet: generate a 12-word BIP39 mnemonic via
   * WalletCore, persist it encrypted, return nothing sensitive.
   * The mnemonic is shown ONCE by the onboarding flow (read via
   * revealSeed with the auth prompt), never stored in plain state.
   */
  async createWallet(): Promise<void> {
    const phrase = core().HDWalletCreateMnemonic(128); // 12 words
    await SecureStorage.storeSeed(phrase);
  }

  /** Import an existing wallet from a 12/24-word phrase. Validates first. */
  async importWallet(phrase: string): Promise<boolean> {
    if (!core().HDWalletMnemonicIsValid(phrase.trim())) {
      return false;
    }
    await SecureStorage.storeSeed(phrase.trim());
    return true;
  }

  /**
   * Reveal the seed phrase for backup/export screens.
   * Access control (PIN/biometric) is enforced by the secure layer itself.
   */
  async revealSeed(): Promise<string | null> {
    return SecureStorage.readSeed();
  }

  /** Derive the receive address for each v1 chain. */
  async deriveAccounts(): Promise<WalletAccount[]> {
    const phrase = await SecureStorage.readSeed();
    if (!phrase) throw new Error('No wallet on this device');

    const storedKey = core().StoredKeyImportPhrase(phrase, 'Veltravia', 'x');
    const accounts: WalletAccount[] = [];

    for (const chain of CHAINS) {
      const coin = chain.id === '1'
        ? COIN_TYPE.ETHEREUM
        : chain.id === '56'
          ? COIN_TYPE.BINANCE
          : COIN_TYPE.POLYGON;
      const hd = core().StoredKeyAccount(storedKey, 'x', coin, DEFAULT_PATH);
      accounts.push({
        chainId: chain.id,
        address: core().HDWalletGetAddressForCoin(hd, coin),
      });
    }
    return accounts;
  }

  async wipe(): Promise<void> {
    await SecureStorage.wipeWallet();
  }
}

export const walletManager = new WalletManager();
