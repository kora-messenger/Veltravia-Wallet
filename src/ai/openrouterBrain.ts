/**
 * Veltravia AI — hosted brain (OpenRouter).
 *
 * A real LLM powers the chat; money stays deterministic:
 *   1. The model may ONLY propose a transfer via a fenced directive
 *        ```veltravia_action {"action":"transfer", ...}```
 *   2. Every directive is validated by the same local pipeline as the
 *      offline brain (prepareTransfer): balance, address, fee, chain.
 *   3. Nothing is executed without the user's Approve + biometrics/passcode.
 * A hallucinated or tampered directive cannot pass step 2.
 *
 * The directive text never reaches the chat bubbles — the splitter below
 * strips it while streaming.
 */

import type { AiBrain, ChatContext, ChatMessage, ConsentRequest } from './protocol';
import { streamChat, OpenRouterError, type ChatCompletionMessage } from './openrouter';
import { prepareTransfer, type ParsedTransfer } from './transfer';
import { MARKET_COINS } from '../services/marketData';
import { APP_CONFIG } from '../config/env';

type Emit = (e: any) => void;
type Signal = { aborted: boolean };

const usd = (v: number) => '$' + v.toFixed(2);

/* ---- system prompt ----------------------------------------------------- */

export function systemPrompt(ctx: ChatContext): string {
  const holdings = ctx.holdings
    .map((h) => `- ${h.symbol}: ${h.amount} (≈${usd(h.amount * h.price)} at ${usd(h.price)}, 24h ${h.change24h >= 0 ? '+' : ''}${h.change24h.toFixed(2)}%)`)
    .join('\n');
  const addresses = Object.entries(ctx.addresses)
    .map(([chain, a]) => `- chain ${chain}: ${a}`)
    .join('\n');
  const market = MARKET_COINS.slice(0, 12)
    .map((c) => `- ${c.name} (${c.symbol}): ${usd(c.priceUsd)}, 24h ${c.change24h >= 0 ? '+' : ''}${c.change24h.toFixed(2)}%`)
    .join('\n');

  return `You are Veltravia AI, the built-in assistant of Veltravia Wallet, a privacy-first crypto wallet. You are a DOER, not a disclaimer machine: your job is to actually help the user with what matters to them — checking balances, reading their portfolio, explaining fees, preparing transfers, walking them through every screen of the wallet, market questions, and fixing problems. Answer the question the user actually asked, in your own words, using what they just told you and the conversation so far. Never reply with a generic menu of what you can do unless the user asks what you can do. Match the length to the question: one line for a quick fact, a short structured answer (a few lines or a short list) when they ask for several things, more detail only when they ask for it. Vary your wording; do not repeat the same phrasing across replies. You may use a light emoji now and then when it fits the topic, like Trust's AI assistant does. Lists use a leading "·" per line; no markdown symbols like ** or #. If the user's message is unclear, ask one short follow-up question instead of guessing. If they ask something unrelated to crypto, answer briefly and kindly, then offer to help with their wallet. Reply in the language the user writes in.

BE HELPFUL FIRST:
- Lead every reply with the useful answer. Do NOT open or close replies with security reminders, or mention security at all unless the user asks about it or a real risk is in front of you. Never talk about "things you cannot see" — if you lack a fact, just say what you do know and answer from that.
- When the user describes a goal (send $50 to a friend, check their portfolio, understand a fee), drive toward completing that goal: give the answer, then either prepare the transfer or point to the exact screen and step.
- You can explain every wallet area on request: balances and the balance card, Swap, Buy, Receive/addresses, Activity and filters, Markets, Discover, Settings, passcode and biometric login, wallet import.
- If asked for live data you do not have (biggest movers across all coins, news, a token not in the snapshot), answer from the snapshot and add one line that live market-wide data is coming to a later build. Never invent figures or tokens.
- Never predict prices, never recommend buying or selling, never promise returns. State facts: prices, 24h moves, balances. If asked directly for financial advice, give factual context and say the choice is theirs.

GUARDRAILS (silent — they shape behavior, they are not talking points):
- NEVER ask for, accept, or repeat a seed phrase, recovery phrase, private key or passcode. If a user pastes or offers one, warn once and move on to helping them. If they ask how to view theirs, say Settings shows it after unlocking.
- Only warn about scams when the user is actually facing one: someone asked for their keys, a "double your crypto" offer, a "verify your wallet" site, a stranger claiming to be support.
- Only mention irreversibility when they are about to send a meaningful amount to someone new.
- You cannot cancel, reverse or speed up on-chain transactions, and you cannot see other people's wallets — say so only if asked to.

THE USER'S WALLET (this device only):
${holdings}
Receive addresses:
${addresses}

MARKET SNAPSHOT (a fixed sample of major coins; it is NOT a live feed and does not cover small-cap tokens):
${market}

WHAT YOU CAN DO:
- Explain the wallet's balances, portfolio, and how transfers/fees work.
- Answer general crypto questions.
- Prepare transfers: see TRANSFER PROTOCOL below.
- Point users to Swap / Receive / Activity screens if they want to act there instead.
- Help with support topics (token not showing, gas problems, stuck transactions, bugs).

TRANSFER PROTOCOL — follow exactly:
- v1 can only send: ETH (Ethereum), BNB (BNB Smart Chain), POL/MATIC (Polygon), USDT (BNB Smart Chain), USDC (Ethereum). If the user asks to send anything else (e.g. BTC), say it is not supported yet in this build.
- If the user wants to send/transfer/pay and ANY of asset, amount, or recipient address is missing or ambiguous, ask ONE short clarifying question. Do not guess.
- If they have all three, reply with ONLY this directive block and no other text:
\`\`\`veltravia_action
{"action":"transfer","symbol":"ETH","usd":100.00,"to":"0x..."}
\`\`\`
  - "usd" (number) if they gave a fiat amount, or "amount" (string) if they gave a coin amount, e.g. {"action":"transfer","symbol":"USDT","amount":"20","to":"0x..."}
  - "to" is the full 0x address exactly as the user wrote it.
  - Never invent an address. Never send a directive unless the user clearly asked to send.
- The app validates the transfer (balance, address, fees) and shows an approval card. You do not need to mention that; the app explains it.
- Never claim a transfer has been sent. The user must approve it on a confirmation card first.`;
}

/* ---- directive splitter (streaming, pure enough to test) ---------------- */

export const MARKER = '```veltravia_action';

export interface SplitterState {
  mode: 'text' | 'directive';
  hold: string; // suffix that might become a marker
  directive: string; // accumulated directive content
}

export function newSplitter(): SplitterState {
  return { mode: 'text', hold: '', directive: '' };
}

/** Longest suffix of s that is a proper prefix of MARKER. */
function markerSuffix(s: string): number {
  for (let n = Math.min(s.length, MARKER.length - 1); n > 0; n--) {
    if (MARKER.startsWith(s.slice(-n))) return n;
  }
  return 0;
}

/**
 * Feed a stream delta; returns the text that is safe to show now.
 * When a directive completes, `state.directive` holds its raw content
 * (JSON between the marker line and the closing fence).
 */
export function feedSplitter(state: SplitterState, delta: string): string {
  if (state.mode === 'directive') {
    state.directive += delta;
    return '';
  }
  state.hold += delta;
  const at = state.hold.indexOf(MARKER);
  if (at !== -1) {
    const before = state.hold.slice(0, at);
    state.directive = state.hold.slice(at + MARKER.length);
    state.hold = '';
    state.mode = 'directive';
    return before;
  }
  const keep = markerSuffix(state.hold);
  const emit = state.hold.slice(0, state.hold.length - keep);
  state.hold = keep ? state.hold.slice(-keep) : '';
  return emit;
}

/** Call at end of stream. Returns any final held text. */
export function flushSplitter(state: SplitterState): string {
  const out = state.hold;
  state.hold = '';
  return state.mode === 'text' ? out : '';
}

/** Extract the JSON payload from a completed directive. */
export function parseDirective(raw: string): Record<string, any> | null {
  const m = raw.match(/[{[][\s\S]*[}\]]/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

/* ---- the brain ---------------------------------------------------------- */

const HISTORY_LIMIT = 12;

function historyToMessages(history: ChatMessage[]): ChatCompletionMessage[] {
  return history
    .filter((m) => m.text.trim().length > 0)
    .slice(-HISTORY_LIMIT)
    .map((m) => ({ role: m.role, content: m.text.slice(0, 2000) }) as ChatCompletionMessage);
}

async function handleDirective(json: Record<string, any> | null, ctx: ChatContext, emit: Emit): Promise<void> {
  const action = json?.action;
  if (action === 'transfer' && json) {
    const p: ParsedTransfer = {
      symbol: typeof json.symbol === 'string' ? json.symbol : undefined,
      usd: typeof json.usd === 'number' ? json.usd : undefined,
      coinAmount: typeof json.amount === 'string' || typeof json.amount === 'number' ? String(json.amount) : undefined,
      to: typeof json.to === 'string' ? json.to : undefined,
      all: json.all === true,
    };
    const result = prepareTransfer(p, ctx);
    if (!result.ok) {
      emit({ type: 'text_delta', text: result.reason + ' ' });
      if (result.needs === 'asset') {
        emit({
          type: 'action',
          action: {
            kind: 'quick_reply',
            replies: ctx.holdings.slice(0, 4).map((h) => ({ label: h.symbol, send: h.symbol })),
          },
        });
      }
      return;
    }
    // The deterministic layer is the single source of truth for the card.
    emit({ type: 'action', action: { kind: 'transfer_approval', proposal: result.proposal } });
    return;
  }
  if (action === 'open_screen' && json && typeof json.target === 'string' && ['swap', 'activity', 'receive'].includes(json.target)) {
    const target = json.target as 'swap' | 'activity' | 'receive';
    const label = target === 'swap' ? 'Open Swap' : target === 'activity' ? 'Open Activity' : 'Open Receive';
    emit({ type: 'action', action: { kind: `open_${target}` as any, label } });
    return;
  }
  emit({ type: 'text_delta', text: 'I could not carry that out. ' });
}

export const openRouterBrain: AiBrain = {
  async send(userText, history, ctx, emit, signal) {
    emit({ type: 'THINKING_STARTED' });
    const messages: ChatCompletionMessage[] = [
      { role: 'system', content: systemPrompt(ctx) },
      ...historyToMessages(history),
      { role: 'user', content: userText },
    ];

    const splitter = newSplitter();
    let directiveComplete = false;

    const onDelta = (text: string) => {
      if (signal.aborted || directiveComplete) return;
      const visible = feedSplitter(splitter, text);
      if (visible) {
        emit({ type: 'THINKING_STOPPED' });
        emit({ type: 'text_delta', text: visible });
      }
      if (splitter.mode === 'directive') {
        // Directive: complete once the closing fence arrives.
        if (splitter.directive.includes('```')) {
          directiveComplete = true;
        }
      }
    };

    try {
      await streamChat(
        {
          model: APP_CONFIG.AI_MODEL || 'anthropic/claude-haiku-5.5',
          messages,
          onDelta,
          signal,
        },
        APP_CONFIG.OPENROUTER_API_KEY || processOpenRouterKey()
      );
      const tail = flushSplitter(splitter);
      if (tail && !signal.aborted) emit({ type: 'text_delta', text: tail });
      if (splitter.mode === 'directive' && !signal.aborted) {
        await handleDirective(parseDirective(splitter.directive), ctx, emit);
      }
      emit({ type: 'THINKING_STOPPED' });
      emit({ type: 'done' });
    } catch (e) {
      emit({ type: 'THINKING_STOPPED' });
      if (e instanceof OpenRouterError) {
        emit({
          type: 'error',
          code: e.code === 'RATE_LIMITED' ? 'RATE_LIMITED' : e.code === 'AUTH' ? 'OFFLINE' : 'UNKNOWN',
          message:
            e.code === 'RATE_LIMITED'
              ? 'The assistant is busy right now. Please try again in a moment.'
              : e.code === 'AUTH'
                ? 'The assistant is not configured on this device.'
                : 'I could not reach the AI service. Check your connection and try again.',
        });
      } else {
        emit({ type: 'error', code: 'UNKNOWN', message: 'Something went wrong. Please try again.' });
      }
    }
  },

  async resolveConsent(_req, allowed, ctx, emit, signal) {
    // The hosted brain already has wallet context in the prompt; consent
    // cards belong to the offline engine. Answer gracefully anyway.
    emit({ type: 'THINKING_STARTED' });
    emit({ type: 'text_delta', text: allowed ? 'Thanks. ' : 'No problem. ' });
    emit({ type: 'THINKING_STOPPED' });
    emit({ type: 'done' });
  },
};

/** Dev escape hatch for local builds without react-native-config wiring. */
function processOpenRouterKey(): string {
  try {
    const g = globalThis as any;
    return g.process?.env?.OPENROUTER_API_KEY ?? '';
  } catch {
    return '';
  }
}
