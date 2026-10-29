/**
 * Veltravia Wallet — the joining side of pairing, in one call.
 *
 * Shared by the scanner (Settings → Paired devices) and the recovery screen
 * (Import → Pair device) so both paths behave identically: validate the code,
 * publish our ephemeral public key, wait for the host's sealed material, then
 * adopt it.
 *
 * The returned safety number is what the user compares against the other
 * device. It is shown before the wallet appears on this phone, because the host
 * has to confirm the same digits to release the key.
 */
import { adoptPairingMaterial, type WalletGroup } from './walletGroup';
import { joinPairingSession, parsePairingCode } from './pairingSession';

export type PairOutcome =
  | { ok: true; group: WalletGroup; safetyNumber: string }
  | {
      ok: false;
      reason: 'scheme' | 'version' | 'malformed' | 'expired' | 'legacy' | 'used' | 'cancelled' | 'invalid' | 'timeout';
    };

export async function pairWithCode(uri: string, deviceName = 'This device'): Promise<PairOutcome> {
  const parsed = parsePairingCode(uri);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  const result = await joinPairingSession(parsed.code);
  if (result.status !== 'joined') return { ok: false, reason: result.status };

  const group = await adoptPairingMaterial(result.material, deviceName);
  if (!group) return { ok: false, reason: 'invalid' };
  return { ok: true, group, safetyNumber: result.safetyNumber };
}

/** Copy for a failed pairing, in the user's language. */
export function pairFailureMessage(reason: Extract<PairOutcome, { ok: false }>['reason']): string {
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
    default:
      return "That code isn't a Veltravia pairing code.";
  }
}
