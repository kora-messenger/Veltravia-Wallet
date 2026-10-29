/**
 * Veltravia Wallet — the six digits, and how hard you can guess them.
 *
 * The digits are a short authentication string: both devices derive the same
 * six numbers from the two ephemeral public keys, and the person carrying them
 * across (by reading the old phone and typing into the new one) is the only
 * thing that catches a relay that swapped a key. The host's screen shows its
 * digits; the new device compares what the human typed against what it derived.
 *
 * Rules, all enforced here rather than in a screen:
 *   • exactly six digits, nothing else, after whitespace is stripped;
 *   • constant-time comparison, so a wrong guess teaches nothing;
 *   • five attempts per session, then the session is dead — the relay entry is
 *     cancelled and the code is burned, so a sixth guess needs a brand new QR;
 *   • the digits are never logged, persisted, or reported anywhere.
 */
import { markDigitsVerified, type JoinHandle } from './pairingSession';
import { pairingRelay } from './pairingRelay';

export const VERIFY_MAX_ATTEMPTS = 5;

interface Attempts {
  used: number;
  dead: boolean;
}

const attempts = new Map<string, Attempts>();

function record(sessionId: string): Attempts {
  let a = attempts.get(sessionId);
  if (!a) {
    a = { used: 0, dead: false };
    attempts.set(sessionId, a);
  }
  return a;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'format' }
  | { ok: false; reason: 'mismatch'; attemptsLeft: number }
  | { ok: false; reason: 'exhausted' };

/** Constant-time compare of two short strings, both already the same shape. */
function sameDigits(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface VerifyOptions {
  /** Attempts allowed for this session. Defaults to VERIFY_MAX_ATTEMPTS. */
  maxAttempts?: number;
}

/**
 * Check the six digits the user typed on the new device. On success the caller
 * may proceed to `completePairingJoin`; on failure the caller must not.
 */
export async function verifyPairingDigits(
  handle: JoinHandle,
  typed: string,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  const max = Math.max(1, options.maxAttempts ?? VERIFY_MAX_ATTEMPTS);
  const state = record(handle.sessionId);
  if (state.dead) return { ok: false, reason: 'exhausted' };

  const digits = (typed ?? '').replace(/\s+/g, '');
  if (!/^[0-9]{6}$/.test(digits)) return { ok: false, reason: 'format' };

  if (sameDigits(digits, handle.safetyNumber)) {
    // Completion refuses to open anything for a session that is not in here.
    markDigitsVerified(handle.sessionId);
    // Success does not reset the counter: the session is single-use anyway, and
    // a reset would let a second attempt sequence ride on a used session.
    return { ok: true };
  }

  state.used += 1;
  const attemptsLeft = max - state.used;
  if (attemptsLeft <= 0) {
    state.dead = true;
    // Kill it properly: cancel the relay row and burn the code, so a captured
    // request cannot be replayed into this session later.
    await pairingRelay.cancel(handle.sessionId).catch(() => {});
    return { ok: false, reason: 'exhausted' };
  }
  return { ok: false, reason: 'mismatch', attemptsLeft };
}

/** Has this session already burned through its attempts? */
export function pairingSessionBurn(sessionId: string): boolean {
  return attempts.get(sessionId)?.dead === true;
}

/** Tests only. */
export function __resetPairingAttemptsForTests(): void {
  attempts.clear();
}

/** Copy for the verify screen, in the user's language. */
export function verifyFailureMessage(result: Extract<VerifyResult, { ok: false }>): string {
  switch (result.reason) {
    case 'format':
      return 'Enter all six digits shown on your existing device.';
    case 'exhausted':
      return "That didn't match too many times. Start again on both devices.";
    default:
      return result.attemptsLeft === 1
        ? "Those digits don't match. One attempt left."
        : `Those digits don't match. ${result.attemptsLeft} attempts left.`;
  }
}
