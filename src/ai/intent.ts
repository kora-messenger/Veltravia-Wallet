/**
 * Veltravia Wallet — reading what the user actually asked for.
 *
 * The failure this exists to prevent: "Do you have the ability to lock my
 * wallet?" is a QUESTION. It must be answered honestly and then offered, never
 * turned into an approval card that freezes sending. A wallet lock is a
 * consequential action — it may only follow a request, never a question about
 * whether the lock exists.
 *
 * Two independent protections use this module:
 *   • the offline rule engine decides before acting;
 *   • the hosted model's directive is suppressed if it contradicts the user's
 *     question (a model can ignore its instructions; code cannot).
 */

export type LockIntent = 'lock' | 'unlock' | 'ask-lock' | 'ask-unlock' | 'decline' | null;

const LOCK_WORD = /\b(lock|freeze|locking|locking down)\b/i;
const UNLOCK_WORD = /\b(unlock|un-freeze|unfreeze)\b/i;
const WALLET_WORD = /\bwallet\b/i;

const INTERROGATIVE_OPEN =
  /^(do|does|did|can|could|would|will|should|shall|is|are|was|were|am|have|has|what|why|how|when|where|who|which|whose|whether)\b/i;

/** A capability/permission/possibility question, or any clearly interrogative message. */
export function isQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.includes('?')) return true;
  return INTERROGATIVE_OPEN.test(t);
}

/** "don't lock my wallet", "never freeze it", "no lock" — an instruction NOT to act. */
export function declinesLockAction(text: string): boolean {
  const t = text.trim();
  return (
    /\b(don'?t|do not|never|stop)\b[^.]*\b(lock|freeze|locking)\b/i.test(t) ||
    /\bno\b[^.]*\b(lock|freeze)\b/i.test(t)
  );
}

/**
 * Classify a message that mentions wallet lock/freeze/unlock.
 * Returns null when the message is not about the wallet lock at all.
 */
export function lockIntent(text: string): LockIntent {
  const t = text.trim();
  if (!t) return null;

  const mentionsLock = LOCK_WORD.test(t);
  const mentionsUnlock = UNLOCK_WORD.test(t);
  if (!mentionsLock && !mentionsUnlock) return null;
  // "unlock" contains no "lock" boundary match, but be explicit for clarity.
  if (!WALLET_WORD.test(t)) return null;

  if (declinesLockAction(t)) return 'decline';

  const kind: 'lock' | 'unlock' = mentionsUnlock ? 'unlock' : 'lock';
  if (isQuestion(t)) return kind === 'lock' ? 'ask-lock' : 'ask-unlock';
  return kind;
}

/**
 * The honest answer to "can you lock my wallet so others can't send coin?"
 *
 * It says yes to what the lock really does and, without hedging, states what it
 * does NOT do: it is an app-level freeze, not an on-chain one. Someone holding
 * the recovery phrase can still move funds from another wallet app. Saying that
 * plainly is the whole point — a user who believes the lock protects them from
 * a stolen phrase would be worse off than one who knows the truth.
 */
export function lockCapabilityAnswer(locked: boolean): string {
  const state = locked
    ? "Your wallet is locked right now, so sending is already frozen."
    : 'Yes. I can lock this wallet, and then you approve it with your security password.';

  return (
    `${state}\n\n` +
    'What the lock actually does: it freezes sending, swapping and AI transfers in this app on this device. ' +
    'Balances, history and receiving keep working normally.\n\n' +
    'What it does not do: it is not an on-chain lock. Anyone who has your recovery phrase or private key can ' +
    'still move the funds from another wallet app. A lock here cannot stop that. The only real protection ' +
    'against a leaked phrase is moving the funds to a fresh wallet.\n\n' +
    (locked
      ? 'If you want it unlocked again, say "unlock my wallet" and I will show the approval card.'
      : 'If you want it frozen here, say "lock my wallet" and I will show the approval card.')
  );
}

/** The honest answer when the user asked about unlocking. */
export function unlockCapabilityAnswer(locked: boolean): string {
  return locked
    ? 'Yes — say "unlock my wallet" and I will show the approval card. You will type your security password and ' +
        'confirm with biometrics or your passcode, and sending works again straight away.'
    : 'Your wallet is not locked, so there is nothing to unlock — sending works normally. The lock only exists to ' +
        'freeze transfers; it never blocks receiving or viewing your balance.';
}
