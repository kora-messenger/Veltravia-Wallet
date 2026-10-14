/**
 * Thinking choreography (Trust parity), shared by the hosted and offline brains.
 *
 *   - every question first shows "AI is thinking..." for at least THINK_MS
 *   - small talk ("Hi") and off-topic questions stay on "AI is thinking..." only
 *   - market questions then switch to "Checking trending tokens..." for TOOL_MS
 *
 * Reply text is held back until the choreography finishes, so a fast model
 * response never flashes the answer before the indicator has been seen.
 */

import { TOOL_LABEL } from './protocol';
import type { AiEvent } from './protocol';

/** Minimum time "AI is thinking..." stays on screen. */
export const THINK_MS = 2000;
/** How long the "Checking trending tokens..." line shows after thinking. */
export const TOOL_MS = 1500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Questions about what the market is doing / trending / moving. */
const MARKET_RE =
  /\b(market|markets|trending|trend|trends|movers?|gainers?|losers?|pumping|dumping|top (coins?|tokens?|cryptos?)|what'?s (going on|happening|moving)|how is (the )?(crypto|market)|crypto news|news)\b/i;

export function isMarketQuestion(text: string): boolean {
  return MARKET_RE.test(text);
}

/**
 * Runs the visible thinking sequence. Resolves once the reply may start
 * streaming. `started` is when the request began, so time already spent
 * waiting on the model counts toward the minimum.
 */
export async function runThinking(
  userText: string,
  emit: (e: AiEvent) => void,
  signal: { aborted: boolean },
  started: number = Date.now()
): Promise<void> {
  const remaining = Math.max(0, THINK_MS - (Date.now() - started));
  if (remaining) await sleep(remaining);
  if (signal.aborted) return;
  if (isMarketQuestion(userText)) {
    emit({ type: 'THINKING_STOPPED' });
    emit({ type: 'tool_call', tool: 'trending', label: TOOL_LABEL.trending });
    await sleep(TOOL_MS);
  }
}
