/**
 * Veltravia Wallet — the joining side of pairing, in one call.
 *
 * Used by the scanner and by the recovery screen (Import → Pair device) so both
 * paths behave identically, and by the "Verify Your Device" screen which supplies
 * the six digits the user typed.
 *
 * What happens, in order, and why the order matters:
 *
 *   1. Validate the QR. Malformed, expired, legacy and cancelled codes stop here.
 *   2. Publish our ephemeral public key. Nothing comes back yet.
 *   3. Compare the user's typed digits against the ones we derived. A mismatch
 *      means the two phones are not looking at the same handshake — the classic
 *      relay-swapped-a-key case — and we abort rather than decrypt anything.
 *   4. Only then wait for the host's sealed box and open it.
 *   5. Store the recovery phrase through the SAME storage layer every other
 *      import uses, then adopt the group, so the new phone can sign, receive and
 *      recover exactly like the old one.
 *
 * The phrase is never written to disk before step 5, is never put in a log, and
 * the box it arrives in cannot be opened by the relay: the key it is sealed to
 * lives only in this process's memory and is gone when the flow ends.
 */
import { adoptPairingMaterial, type WalletGroup } from './walletGroup';
import {
  beginPairingJoin,
  completePairingJoin,
  parsePairingCode,
  safetyNumber,
  type JoinHandle,
} from './pairingSession';
import { verifyPairingDigits } from './pairingVerify';
import { storeSeed } from '../storage/secureStorage';
import { wipeWallet } from '../storage/secureStorage';
import { walletManager, type WalletAccount } from '../wallet/walletManager';

export type PairFailure =
  | 'scheme'
  | 'version'
  | 'malformed'
  | 'expired'
  | 'legacy'
  | 'used'
  | 'cancelled'
  | 'invalid'
  | 'timeout'
  | 'code-format'
  | 'code-mismatch'
  | 'code-exhausted'
  | 'unverified'
  | 'identity';

export type IdentityCheck = 'verified' | 'mismatch' | 'unavailable';

export type PairOutcome =
  | {
      ok: true;
      group: WalletGroup;
      safetyNumber: string;
      seeded: boolean;
      /**
       * Whether this device proved it derived the SAME addresses as the old one.
       * 'unavailable' means the native derivation bridge is not in this build, so
       * nobody checked — reported honestly instead of assumed.
       */
      identity: IdentityCheck;
    }
  | { ok: false; reason: PairFailure; attemptsLeft?: number };

export interface BeginPairOutcome {
  handle: JoinHandle;
  /** Digits this device derived; the host shows the same ones. Compare, don't send. */
  safetyNumber: string;
}

export type BeginResult =
  | { ok: true; begun: BeginPairOutcome }
  | { ok: false; reason: PairFailure };

/** Step 1: read the QR and announce ourselves. No secrets involved yet. */
export async function beginPairingFromUri(uri: string): Promise<BeginResult> {
  const parsed = parsePairingCode(uri);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  const begun = await beginPairingJoin(parsed.code);
  if (begun.status !== 'begun') return { ok: false, reason: begun.status };
  return { ok: true, begun: { handle: begun.handle, safetyNumber: begun.handle.safetyNumber } };
}

/**
 * Steps 3–5: verify the typed digits, then receive and store the wallet.
 * `name` is the label this phone will appear under in Paired devices.
 */
export async function finishPairing(
  begun: BeginPairOutcome,
  typedDigits: string,
  deviceName = 'This device',
): Promise<PairOutcome> {
  const verified = await verifyPairingDigits(begun.handle, typedDigits);
  if (!verified.ok) {
    if (verified.reason === 'format') return { ok: false, reason: 'code-format' };
    if (verified.reason === 'exhausted') return { ok: false, reason: 'code-exhausted' };
    return { ok: false, reason: 'code-mismatch', attemptsLeft: verified.attemptsLeft };
  }

  const joined = await completePairingJoin(begun.handle);
  if (joined.status !== 'joined') {
    return { ok: false, reason: joined.status };
  }

  // The phrase lands here, in the keystore, through the ordinary import path.
  // If it fails, adopt nothing: a paired device with no wallet is worse than a
  // clear failure, because the user would be told they were done.
  if (joined.seed) {
    try {
      await storeSeed(joined.seed);
    } catch {
      return { ok: false, reason: 'invalid' };
    }
  }

  const identity = await checkIdentity(joined.accounts);

  if (identity === 'mismatch') {
    // Same phrase must mean same addresses. If it does not, this is not the
    // wallet the user thinks they paired, so nothing is kept.
    await wipeWallet().catch(() => {});
    return { ok: false, reason: 'identity' };
  }

  const group = await adoptPairingMaterial(joined.material, deviceName);
  if (!group) return { ok: false, reason: 'invalid' };

  return {
    ok: true,
    group,
    safetyNumber: joined.safetyNumber ?? safetyNumber(begun.handle.hostPub, begun.handle.joinerPub),
    seeded: !!joined.seed,
    identity,
  };
}

/**
 * Compare the addresses this device derives from the newly stored phrase against
 * the ones the old device sent. Same wallet means same addresses on every chain;
 * anything else is a failure, not a warning.
 */
async function checkIdentity(hostAccounts: WalletAccount[] | null | undefined): Promise<IdentityCheck> {
  if (!hostAccounts || hostAccounts.length === 0) return 'unavailable';
  let mine: WalletAccount[];
  try {
    mine = await walletManager.deriveAccounts();
  } catch {
    return 'unavailable';
  }
  if (mine.length === 0) return 'unavailable';
  const same = hostAccounts.every((h) => {
    const match = mine.find((m) => m.chainId === h.chainId);
    return !!match && match.address.toLowerCase() === h.address.toLowerCase();
  });
  return same ? 'verified' : 'mismatch';
}

/** One-shot convenience: begin, verify, finish. */
export async function pairWithCode(
  uri: string,
  deviceName = 'This device',
  typedDigits = '',
): Promise<PairOutcome> {
  const began = await beginPairingFromUri(uri);
  if (!began.ok) return { ok: false, reason: began.reason };
  return finishPairing(began.begun, typedDigits, deviceName);
}

/** Copy for a failed pairing, in the user's language. */
export function pairFailureMessage(reason: PairFailure, attemptsLeft?: number): string {
  switch (reason) {
    case 'expired':
      return 'That pairing code has expired. Ask for a new one on the other device.';
    case 'used':
      return 'That pairing code has already been used.';
    case 'cancelled':
      return 'Pairing was cancelled on the other device.';
    case 'legacy':
      return 'That code is from an older version and is no longer accepted. Update both devices.';
    case 'invalid':
      return "Pairing didn't complete. The code may have been tampered with.";
    case 'code-format':
      return 'Enter all six digits shown on your existing device.';
    case 'code-mismatch':
      return attemptsLeft === 1
        ? "Those digits don't match the other device. One attempt left."
        : `Those digits don't match the other device. ${attemptsLeft ?? 4} attempts left.`;
    case 'code-exhausted':
      return "That didn't match too many times. Start again on both devices.";
    case 'unverified':
      return 'Those six digits have to be confirmed before this wallet can be paired.';
    case 'identity':
      return "This phone derived different addresses, so it isn't the same wallet. Nothing was saved.";
    default:
      return "That code isn't a Veltravia pairing code.";
  }
}
