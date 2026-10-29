/**
 * "Do you have the ability to lock my wallet?" is a QUESTION.
 *
 * Ijezie hit exactly this: he asked whether the wallet COULD be locked and the
 * AI produced a lock approval card. A lock freezes someone's funds, so it must
 * follow a request only. These tests pin the distinction, and pin the honesty of
 * the answer: the lock is app-level, not on-chain, and it does not protect a
 * leaked recovery phrase.
 */
import { isQuestion, lockIntent, declinesLockAction, lockCapabilityAnswer } from '../src/ai/intent';

const ASKED = 'Do you have the ability to lock my wallet to avoid others to send coin';

describe('question detection', () => {
  it('treats a question mark or an interrogative opener as a question', () => {
    expect(isQuestion(ASKED)).toBe(true);
    expect(isQuestion('can you freeze my wallet?')).toBe(true);
    expect(isQuestion('how do I lock my wallet')).toBe(true);
    expect(isQuestion('what happens if my wallet is locked')).toBe(true);
    expect(isQuestion('lock my wallet')).toBe(false);
    expect(isQuestion('please freeze the wallet now')).toBe(false);
  });
});

describe('lock intent', () => {
  it('classifies the question that caused the bug as ask-lock, not a command', () => {
    expect(lockIntent(ASKED)).toBe('ask-lock');
  });

  it('accepts a real request', () => {
    expect(lockIntent('lock my wallet')).toBe('lock');
    expect(lockIntent('please freeze my wallet')).toBe('lock');
    expect(lockIntent('unlock my wallet')).toBe('unlock');
  });

  it('honours a refusal instead of doing the opposite', () => {
    expect(declinesLockAction("don't lock my wallet")).toBe(true);
    expect(lockIntent("don't lock my wallet")).toBe('decline');
    expect(lockIntent('do not freeze the wallet')).toBe('decline');
  });

  it('ignores messages that are not about the wallet lock', () => {
    expect(lockIntent('what is ethereum')).toBeNull();
    expect(lockIntent('lock token')).toBeNull();
  });
});

describe('the honest capability answer', () => {
  const answer = lockCapabilityAnswer(false);

  it('answers yes and explains what the lock does', () => {
    expect(answer).toMatch(/^Yes\. I can lock this wallet/);
    expect(answer).toMatch(/freezes sending, swapping and AI transfers/);
  });

  it('does not oversell it: not on-chain, no protection from a leaked phrase', () => {
    expect(answer).toMatch(/not an on-chain lock/);
    expect(answer).toMatch(/recovery phrase or private key can still move the funds/);
    expect(answer).toMatch(/moving the funds to a fresh wallet/);
  });

  it('offers the action rather than taking it, and reports an existing lock', () => {
    expect(answer).toMatch(/say "lock my wallet"/);
    expect(lockCapabilityAnswer(true)).toMatch(/already frozen|is locked right now/);
    expect(lockCapabilityAnswer(true)).not.toMatch(/say "lock my wallet"/);
  });
});
