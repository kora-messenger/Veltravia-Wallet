/**
 * Veltravia Wallet — wallet accounts (v1).
 *
 * A WalletAccount is a named profile the user can switch between from the
 * home header pill (Wallets screen). v1 stores metadata only: the actual
 * key material arrives with the Wallet Core integration (Phase 2), which
 * will attach addresses/seed references to these records.
 */

export interface WalletAccount {
  id: string;
  /** Display name shown in the header pill and Wallets list. */
  name: string;
  /** Key into WALLET_COLORS ('veltravia' = the app logo). */
  color: string;
  /** Key into WALLET_GLYPHS ('veltravia' = the app logo). */
  icon: string;
  /** True while this wallet is the one shown on Home. */
  active: boolean;
  /** False until the user completes the (Phase 2) backup flow. */
  backedUp: boolean;
  createdAt: number;
  /** 'created' via Name your wallet, or 'imported' via recovery phrase. */
  origin: 'default' | 'created' | 'imported';
}
