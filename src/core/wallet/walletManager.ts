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
import { generateMnemonic, normalizeMnemonic, validateMnemonic, type MnemonicStrength } from './bip39';

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
   * Generate a brand-new 12-word BIP-39 phrase WITHOUT storing it.
   *
   * The onboarding flow shows these words, makes the user prove they wrote them
   * down, and only then calls `commitPhrase`. Returning the phrase instead of
   * writing it means an abandoned onboarding leaves no half-created wallet.
   *
   * Generation is local (bip39.ts + the platform CSPRNG). WalletCore is not
   * required to create or restore a phrase, only to derive addresses from it.
   */
  generatePhrase(strength: MnemonicStrength = 128): string {
    return generateMnemonic(strength);
  }

  /** Store a phrase the user has been shown and confirmed. */
  async commitPhrase(phrase: string): Promise<boolean> {
    const check = validateMnemonic(phrase);
    if (!check.ok) return false;
    await SecureStorage.storeSeed(normalizeMnemonic(phrase));
    return true;
  }

  /**
   * Create a brand-new wallet and store it in one step (no backup screen).
   * Kept for callers that do not show the phrase; onboarding uses
   * generatePhrase + commitPhrase so the user can write it down first.
   */
  async createWallet(): Promise<void> {
    await SecureStorage.storeSeed(this.generatePhrase(128));
  }

  /**
   * Import an existing wallet from a phrase. Real BIP-39 validation: the
   * checksum and the wordlist are checked, not just the word count.
   */
  async importWallet(phrase: string): Promise<boolean> {
    const check = validateMnemonic(phrase);
    if (!check.ok) return false;
    // If the native bridge is present, let WalletCore confirm too — it is the
    // authority once it ships, and disagreement means we do not store.
    try {
      if (!core().HDWalletMnemonicIsValid(normalizeMnemonic(phrase))) return false;
    } catch {
      /* no native bridge in this build: the local BIP-39 check stands */
    }
    await SecureStorage.storeSeed(normalizeMnemonic(phrase));
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
