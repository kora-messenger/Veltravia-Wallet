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
import { runThinking } from './thinking';
import { walletLocked } from '../core/security/walletLock';

type Emit = (e: any) => void;
type Signal = { aborted: boolean };

const usd = (v: number) => '$' + v.toFixed(2);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

  const memory = ctx.previousChat
    ? formatRecall(ctx.previousChat)
    : 'No previous conversation on record.';

  return `You are Veltravia AI, the built-in assistant of Veltravia Wallet, a privacy-first crypto wallet. You are a knowledgeable, personable crypto companion — not a scripted bot. While you can certainly check balances, explain fees, and prepare transfers when asked, you are here to talk about ALL things crypto: the market, trends and community sentiment, blockchain concepts, new projects, and how to get the most out of the wallet.

HOW YOU TALK (this is who you are):
- Warm, confident and professional. Lead with the answer, then give it substance: organize multi-part answers with "·" bullets, each starting with a bolded-style category name and a one-line explanation, ending with a fitting emoji — like:
  · Crypto News & Trends: what's moving the market and why. 📈
- A light emoji at the end of a key point or bullet when it fits the topic. A few per reply, never a wall of them. No markdown symbols like ** or #; no emojis inside passwords or addresses.
- Match the user's energy: quick question, quick friendly answer; bigger question, structured answer that teaches. Never dry one-word replies, and never bury the answer under caveats.
- Close replies naturally: a useful next step, or an inviting follow-up question when it fits (e.g. "What's on your mind today? 😊"). Vary your wording; never repeat the same closing line.
- Reply in the language the user writes in.

WHAT YOU ARE GREAT AT:
· Wallet Help: balances, portfolio, fees, preparing transfers, activity, swaps. 💼
· Crypto News & Trends: what the market is doing (answer from your snapshot; live market-wide data is coming in a later build). 📰
· Asset Info: what a token is, how it works, what to watch out for. 🔍
· Blockchain Concepts: DeFi, staking, L2s, account abstraction, how transactions actually work. 💡
· Veltravia How-To's: walking the user through every screen and feature of the wallet. ✨
· Community & Ecosystem: projects, sentiment, how new tech fits in — chat about it all. 🌍

MEMORY — RECALLING PAST CONVERSATIONS:
- Below is your most recent previous conversation with this user (title, date, and the tail of the transcript). If the user picks up an earlier thread ("remember when I asked...", "that coin we talked about"), recall it naturally and continue where it left off.
- Never say you cannot remember. If something is not in the transcript below or the current chat, just say what you do know and answer from that.
- Refer to it as "our last chat", never as a "transcript" or "data".

${memory}

THE USER'S WALLET (this device only, this wallet only):
${holdings}
Receive addresses:
${addresses}
The wallet you serve is "${ctx.walletName}" and it is currently ${walletLocked(ctx.walletId) ? 'LOCKED: transfers are refused until it is unlocked' : 'unlocked'}.

MARKET SNAPSHOT (a fixed sample of major coins; it is NOT a live feed and does not cover small-cap tokens):
${market}

BEING REAL ABOUT LIMITS (silent — shape answers, never recite them):
- If asked for live data you do not have (biggest movers across all coins, news, a token not in the snapshot), answer from the snapshot and add ONE line that live market-wide data is coming to a later build. Never invent figures or tokens.
- Never predict prices, never recommend buying or selling, never promise returns. State facts: prices, 24h moves, balances. If asked directly for financial advice, give factual context and say the choice is theirs.
- Only mention irreversibility when they are about to send a meaningful amount to someone new.
- You cannot cancel, reverse or speed up on-chain transactions, and you cannot see other people's wallets — say so only if asked.

GUARDRAILS (silent):
- NEVER ask for, accept, or repeat a seed phrase, recovery phrase, private key or passcode. If a user pastes or offers one, warn once and move on to helping them. If they ask how to view theirs, say Settings shows it after unlocking.
- Only warn about scams when the user is actually facing one: someone asked for their keys, a "double your crypto" offer, a "verify your wallet" site, a stranger claiming to be support.
- If the user's message is unclear, ask ONE short follow-up question instead of guessing.

WALLET LOCK — follow exactly:
- If they ask to lock / freeze their wallet, reply with ONLY this directive block and no other text:
\`\`\`veltravia_action
{"action":"wallet_lock"}
\`\`\`
- If they ask to unlock it, reply with ONLY this directive block and no other text:
\`\`\`veltravia_action
{"action":"wallet_unlock"}
\`\`\`
- Directives are ALWAYS inside a \`\`\`veltravia_action code fence, never as plain text in the message.
- Never claim the wallet is locked or unlocked yourself. The app shows an approval card where the user types their SECURITY PASSWORD (a text password, different from their passcode), then confirms with biometrics; only then does the lock state change.
- The security password is separate from the passcode and biometrics and is set per wallet. If the user has not set one yet, the approval card lets them create it right there — no need to send them to Settings.

OPEN SCREEN PROTOCOL — follow exactly:
- You CAN give the user a tappable button that takes them to a screen. If they ask to go to / open / see a button for a screen, reply with ONLY this directive block and no other text:
\`\`\`veltravia_action
{"action":"open_screen","target":"activity"}
\`\`\`
  - valid targets: "swap", "activity", "receive", "settings"
  - "label" (optional string) names the button, e.g. {"action":"open_screen","target":"activity","label":"Go to Activity"}
- Supported screens are ONLY: Swap, Activity (transaction history), Receive (deposit address/QR), Settings. For Markets, Discover or Wallets just tell the user which tab to tap at the bottom; do not emit a directive for them.
- Never say you cannot open screens or create buttons — you can, via this directive.

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

/** Compact transcript of the previous conversation, for the prompt's memory. */
function formatRecall(chat: { title: string; at: number; messages: ChatMessage[] }): string {
  const lines = (chat.messages ?? [])
    .filter((m) => m.text && m.text.trim().length > 0)
    .slice(-16)
    .map((m) => `${m.role === 'user' ? 'user' : 'assistant'}: ${m.text.replace(/\s+/g, ' ').slice(0, 400)}`);
  const when = new Date(chat.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `LAST CHAT ("${chat.title}", ${when}):
${lines.join('\n')}`;
}

/* ---- directive splitter (streaming, pure enough to test) ---------------- */

export const MARKER = '```veltravia_action';

export interface SplitterState {
  mode: 'text' | 'directive' | 'discard';
  /** true = bare JSON directive (no code fence) — closes on '}', rest discarded. */
  bare: boolean;
  hold: string; // suffix that might become a marker
  directive: string; // accumulated directive content
}

export function newSplitter(): SplitterState {
  return { mode: 'text', bare: false, hold: '', directive: '' };
}

/** Longest suffix of s that is a proper prefix of MARKER. */
function markerSuffix(s: string): number {
  for (let n = Math.min(s.length, MARKER.length - 1); n > 0; n--) {
    if (MARKER.startsWith(s.slice(-n))) return n;
  }
  return 0;
}

/**
 * Models sometimes skip the code fence and emit the directive as bare JSON
 * ({"action":"wallet_unlock"}). Longest suffix of s that is a proper prefix
 * of that opener — held back mid-stream so a split delta still resolves.
 */
const BARE_START = '{"action"';

function bareSuffix(s: string): number {
  for (let n = Math.min(s.length, BARE_START.length - 1); n > 0; n--) {
    if (BARE_START.startsWith(s.slice(-n))) return n;
  }
  return 0;
}

/** Bare directive ended at its first '}' — flat JSON, no nested braces. */
function closeBare(state: SplitterState): void {
  const close = state.directive.indexOf('}');
  if (close !== -1) {
    state.directive = state.directive.slice(0, close + 1);
    state.mode = 'discard'; // rest of the reply is junk ("...", stray words)
  }
}

/**
 * Feed a stream delta; returns the text that is safe to show now.
 * When a directive completes, `state.directive` holds its raw content
 * (JSON between the marker line and the closing fence).
 */
export function feedSplitter(state: SplitterState, delta: string): string {
  if (state.mode === 'discard') return '';
  if (state.mode === 'directive') {
    state.directive += delta;
    if (state.bare) closeBare(state);
    return '';
  }
  state.hold += delta;
  // Fenced form first...
  const at = state.hold.indexOf(MARKER);
  if (at !== -1) {
    const before = state.hold.slice(0, at);
    state.directive = state.hold.slice(at + MARKER.length);
    state.hold = '';
    state.mode = 'directive';
    state.bare = false;
    if (splitterDirectiveDone(state)) state.mode = 'discard';
    return before;
  }
  // ...then the bare-JSON form a model may emit without fences.
  const bare = state.hold.indexOf(BARE_START);
  if (bare !== -1) {
    const before = state.hold.slice(0, bare);
    state.directive = state.hold.slice(bare);
    state.hold = '';
    state.mode = 'directive';
    state.bare = true;
    closeBare(state);
    return before;
  }
  const keep = Math.max(markerSuffix(state.hold), bareSuffix(state.hold));
  const emit = state.hold.slice(0, state.hold.length - keep);
  state.hold = keep ? state.hold.slice(-keep) : '';
  return emit;
}

/** True once the accumulated directive content shows a closing fence. */
function splitterDirectiveDone(state: SplitterState): boolean {
  return !state.bare && state.directive.includes('```');
}

/** Call at end of stream. Returns any final held text. */
export function flushSplitter(state: SplitterState): string {
  const out = state.hold;
  state.hold = '';
  return state.mode === 'text' ? out : '';
}

/** True if the splitter captured a directive (fenced or bare). */
export function hasDirective(state: SplitterState): boolean {
  return state.mode === 'directive' || state.mode === 'discard';
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

async function handleDirective(
  json: Record<string, any> | null,
  ctx: ChatContext,
  emit: Emit,
  signal: Signal
): Promise<void> {
  const action = json?.action;
  if ((action === 'wallet_lock' || action === 'wallet_unlock') && json) {
    const lock = action === 'wallet_lock';
    // Same status choreography as the offline brain.
    emit({ type: 'tool_call', tool: 'wallet-lock', label: lock ? 'Requesting wallet lock...' : 'Requesting wallet unlock...' });
    await sleep(900);
    emit({ type: 'tool_call', tool: 'wallet-lock', label: lock ? 'Wallet lock requested' : 'Wallet unlock requested' });
    await sleep(600);
    emit({
      type: 'text_delta',
      text: lock
        ? `Wallet lock requested for ${ctx.walletName}. Review the card below — type your security password (create it there if you haven't yet) and confirm with biometrics or your passcode. `
        : `Wallet unlock requested for ${ctx.walletName}. Review the card below — type your security password and confirm with biometrics or your passcode. `,
    });
    emit({ type: 'action', action: { kind: 'wallet_lock', lock } });
    return;
  }
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
      if (result.needs === 'unlock') {
        emit({ type: 'action', action: { kind: 'quick_reply', replies: [{ label: 'Unlock my wallet', send: 'Unlock my wallet' }] } });
        return;
      }
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
  if (action === 'open_screen' && json && typeof json.target === 'string' && ['swap', 'activity', 'receive', 'settings'].includes(json.target)) {
    const target = json.target as 'swap' | 'activity' | 'receive' | 'settings';
    const fallback =
      target === 'swap' ? 'Open Swap' : target === 'activity' ? 'Open Activity' : target === 'receive' ? 'Open Receive' : 'Open Settings';
    const label = typeof json.label === 'string' && json.label.trim() ? json.label.trim().slice(0, 60) : fallback;
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

    // Reply text is held until the visible thinking sequence has run its course
    // (2s "AI is thinking...", then "Checking trending tokens..." for market asks).
    const startedAt = Date.now();
    let released = false;
    let held = '';
    const thinkingDone = runThinking(userText, emit, signal, startedAt).then(() => {
      released = true;
      if (held && !signal.aborted) {
        emit({ type: 'THINKING_STOPPED' });
        emit({ type: 'text_delta', text: held });
      }
      held = '';
    });

    const onDelta = (text: string) => {
      if (signal.aborted || directiveComplete) return;
      const visible = feedSplitter(splitter, text);
      if (visible) {
        if (!released) {
          held += visible;
        } else {
          emit({ type: 'THINKING_STOPPED' });
          emit({ type: 'text_delta', text: visible });
        }
      }
      if (splitter.mode === 'discard' || splitterDirectiveDone(splitter)) {
        directiveComplete = true;
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
      if (tail) {
        if (released) {
          if (!signal.aborted) emit({ type: 'text_delta', text: tail });
        } else {
          held += tail;
        }
      }
      await thinkingDone; // flushes any held text
      if (hasDirective(splitter) && !signal.aborted) {
        await handleDirective(parseDirective(splitter.directive), ctx, emit, signal);
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
