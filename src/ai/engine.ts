/**
 * Veltravia AI — local brain.
 *
 * Implements AiBrain with the same event stream a hosted gateway will emit
 * (see protocol.ts). Phase 2 swaps this for the WebSocket client; the UI
 * does not change.
 *
 * What it does:    balances, prices, trending, portfolio, receive address,
 *                  security guidance, support triage, TRANSFER PREPARATION,
 *                  swap/receive/activity shortcuts.
 * What it refuses: seed phrase / private key / passcode requests (never
 *                  asks for them, never reveals them), price predictions
 *                  or "guaranteed" returns, signing without the user's
 *                  approval, anything it cannot verify.
 */

import { runThinking } from './thinking';
import type { AiBrain, AiEvent, ChatContext, ChatMessage, ConsentRequest, ToolName } from './protocol';
import { TOOL_LABEL } from './protocol';
import { looksLikeTransfer, parseTransfer, prepareTransfer, type ParsedTransfer } from './transfer';
import { MARKET_COINS } from '../services/marketData';
import { walletLocked } from '../core/security/walletLock';

type Emit = (e: AiEvent) => void;
type Signal = { aborted: boolean };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Streams text word-by-word, stopping immediately if the user hits Stop. */
async function say(text: string, emit: Emit, signal: Signal) {
  const parts = text.split(/(\s+)/);
  for (const part of parts) {
    if (signal.aborted) return;
    emit({ type: 'text_delta', text: part });
    if (part.trim()) await sleep(22);
  }
}

async function tool(name: ToolName, emit: Emit, signal: Signal, ms = 650) {
  if (signal.aborted) return;
  emit({ type: 'tool_call', tool: name, label: TOOL_LABEL[name] });
  await sleep(ms);
}

const usd = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---- guardrails ------------------------------------------------------- */

const SECRET_RE =
  /\b(seed ?phrase|recovery ?phrase|secret ?phrase|mnemonic|private ?key|passcode|pin ?code|my pin|password)\b/i;
const PREDICT_RE =
  /\b(will .* (go up|moon|pump|10x|100x)|price prediction|guarantee|guaranteed|financial advice|should i (buy|invest)|get rich|pump)\b/i;
const SCAM_RE = /\b(double my|doubling|giveaway|airdrop claim|send me .* and (i'll|i will) (send|return))\b/i;

const REFUSE_SECRET =
  "I'll never ask for your seed phrase, private keys or passcode, and I can't see them. " +
  'Anyone asking for them, including someone pretending to be Veltravia support, is a scammer. ' +
  'Your recovery phrase is only ever shown inside Settings after you authenticate.';

/* ---- engine ----------------------------------------------------------- */

let consentSeq = 0;
/** Intent waiting for the user to allow a wallet-data check. */
const pendingConsent = new Map<string, string>();

function holdingsTotal(ctx: ChatContext) {
  return ctx.holdings.reduce((s, h) => s + h.amount * h.price, 0);
}

function findCoin(text: string) {
  const t = text.toLowerCase();
  return MARKET_COINS.find(
    (c) => new RegExp(`\\b${c.symbol.toLowerCase()}\\b`).test(t) || t.includes(c.name.toLowerCase())
  );
}

async function handleTransfer(text: string, ctx: ChatContext, history: ChatMessage[], emit: Emit, signal: Signal) {
  // Merge with the previous user turn(s) so "send $100 ETH" then "to 0x…" works.
  const recentUser = history.filter((m) => m.role === 'user').slice(-3).map((m) => m.text);
  const merged: ParsedTransfer = {};
  for (const t of [...recentUser, text]) {
    if (!looksLikeTransfer(t) && !/0x[0-9a-fA-F]{6,}/.test(t) && !/[0-9]/.test(t)) continue;
    const p = parseTransfer(t);
    Object.assign(merged, Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)));
  }
  // The newest message wins on conflicts.
  Object.assign(merged, Object.fromEntries(Object.entries(parseTransfer(text)).filter(([, v]) => v !== undefined)));

  await tool('transfer', emit, signal);
  if (signal.aborted) return;

  const result = prepareTransfer(merged, ctx);
  if (!result.ok) {
    await say(result.reason, emit, signal);
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

  const p = result.proposal;
  await say(
    `Here's the transfer I've prepared. Nothing is sent until you approve it. ` +
      `You'll confirm with your ${'biometrics or passcode'} on the next step.`,
    emit,
    signal
  );
  if (!signal.aborted) emit({ type: 'action', action: { kind: 'transfer_approval', proposal: p } });
}

/**
 * AI-initiated wallet lock / unlock.
 *
 * Status choreography (product spec):
 *   "AI is thinking..." -> "Requesting wallet lock..." -> "Wallet lock requested"
 *   -> approval card (Cancel / Approve). Approve asks for the security
 *   password; the "Initiating..." sequence runs AFTER authentication, in
 *   the chat screen (it owns the execution step).
 */
async function handleWalletLock(lock: boolean, ctx: ChatContext, emit: Emit, signal: Signal) {
  const wid = ctx.walletId;
  if (lock && walletLocked(wid)) {
    await say(
      'Your wallet is already locked. Balances stay visible, but sending is blocked until you unlock it.',
      emit,
      signal
    );
    return;
  }
  if (!lock && !walletLocked(wid)) {
    await say('Your wallet is not locked right now — sending works normally. Only lock it when you want transfers frozen.', emit, signal);
    return;
  }
  await tool('wallet-lock', emit, signal, 900); // "Requesting wallet lock..."
  if (signal.aborted) return;
  emit({ type: 'tool_call', tool: 'wallet-lock', label: lock ? 'Wallet lock requested' : 'Wallet unlock requested' });
  await sleep(600);
  if (signal.aborted) return;
  await say(
    lock
      ? `Wallet lock requested for ${ctx.walletName}. Review the card below and approve it — type your security password, then confirm with biometrics or your passcode.`
      : `Wallet unlock requested for ${ctx.walletName}. Review the card below and approve it — type your security password, then confirm with biometrics or your passcode.`,
    emit,
    signal
  );
  if (!signal.aborted) emit({ type: 'action', action: { kind: 'wallet_lock', lock } });
}

export const localBrain: AiBrain = {
  async send(userText, history, ctx, emit, signal) {
    emit({ type: 'THINKING_STARTED' });
    await runThinking(userText, emit, signal);
    if (signal.aborted) return emit({ type: 'THINKING_STOPPED' });
    const text = userText.trim();
    const lower = text.toLowerCase();

    try {
      // 1. security guardrails come first
      if (SECRET_RE.test(text) && !looksLikeTransfer(text)) {
        emit({ type: 'THINKING_STOPPED' });
        await say(REFUSE_SECRET, emit, signal);
        return emit({ type: 'done' });
      }
      if (SCAM_RE.test(text)) {
        emit({ type: 'THINKING_STOPPED' });
        await say(
          "That sounds like a common scam pattern. Nobody can legitimately double your crypto, and " +
            "genuine airdrops never ask you to send funds first. I'd advise against going ahead.",
          emit,
          signal
        );
        return emit({ type: 'done' });
      }

      // 2. AI-initiated wallet lock / unlock
      if (/\bunlock\b[^.]*\bwallet\b|\bwallet\b[^.]*\bunlock\b/i.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await handleWalletLock(false, ctx, emit, signal);
        return emit({ type: 'done' });
      }
      if (/\b(lock|freeze)\b[^.]*\bwallet\b|\bwallet\b[^.]*\b(lock|freeze)\b/i.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await handleWalletLock(true, ctx, emit, signal);
        return emit({ type: 'done' });
      }

      // 2b. transfers
      const mentionsAddr = /0x[0-9a-fA-F]{6,}/.test(text);
      const priorTransferTurn =
        mentionsAddr && history.slice(-4).some((m) => m.role === 'user' && looksLikeTransfer(m.text));
      if (looksLikeTransfer(text) || priorTransferTurn) {
        emit({ type: 'THINKING_STOPPED' });
        await handleTransfer(text, ctx, history, emit, signal);
        return emit({ type: 'done' });
      }

      // 3. support triage chips (needs consent to read balances)
      if (/token or balance not showing|balance (is )?(missing|not showing|wrong)|missing (token|balance|funds)/i.test(text)) {
        emit({ type: 'THINKING_STOPPED' });
        await say(
          'I want to check your wallet balances to see whether the funds are present but hidden from the ' +
            "app's list, or whether they are not showing in the wallet. If the balance is present, I'll guide you " +
            'through enabling the token and refreshing the wallet.\n\nWhich token or balance is missing?\n\n' +
            'Checking this needs a couple of things from your wallet, if that\'s okay with you:',
          emit,
          signal
        );
        const req: ConsentRequest = {
          id: `c_${++consentSeq}`,
          wallet: Object.values(ctx.addresses)[0]?.replace(/^(.{6}).*(.{4})$/, '$1...$2') ?? 'This wallet',
          networks: Object.keys(ctx.addresses).length,
          access: 'Balances, token settings and signing permissions',
          scope: 'This conversation only',
          footnote:
            "I'll never see your secret recovery phrase, your private keys, or your other wallets. " +
            'Nothing is ever signed, moved, or changed.',
          resumeIntent: 'balance_check',
        };
        pendingConsent.set(req.id, req.resumeIntent);
        emit({ type: 'consent', request: req });
        return emit({ type: 'done' });
      }

      if (/gas|fee|network problem/i.test(lower) && /problem|issue|high|stuck|expensive|too/.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await say(
          "Network fees are paid in each chain's native coin: ETH on Ethereum, BNB on BNB Smart Chain, POL on " +
            'Polygon. If a transaction fails for fees, make sure you hold a little of that native coin. ' +
            'Which network are you on?',
          emit,
          signal
        );
        emit({
          type: 'action',
          action: {
            kind: 'quick_reply',
            replies: [
              { label: 'Ethereum', send: 'Ethereum' },
              { label: 'BNB Smart Chain', send: 'BNB Smart Chain' },
              { label: 'Polygon', send: 'Polygon' },
            ],
          },
        });
        return emit({ type: 'done' });
      }

      if (/stuck|failed|pending/.test(lower) && /transaction|tx|transfer|send/.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await tool('wallet-address', emit, signal, 500);
        await say(
          'A pending transaction is usually waiting on network congestion or a low fee. It cannot be cancelled ' +
            'from the chat, but you can see its live status on your Activity page. If it stays pending for hours, ' +
            'I can connect you with support.',
          emit,
          signal
        );
        emit({ type: 'action', action: { kind: 'open_activity', label: 'Open Activity' } });
        emit({ type: 'action', action: { kind: 'talk_to_support', label: 'Talk to support' } });
        return emit({ type: 'done' });
      }

      if (/report .*bug|outage|app (is )?(crash|broken|not working)|bug/.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await say(
          "Sorry about that. Tell me what you were doing and what went wrong, and I'll pass it to the team. " +
            'Please do not include your seed phrase or private keys.',
          emit,
          signal
        );
        emit({ type: 'action', action: { kind: 'talk_to_support', label: 'Talk to support' } });
        return emit({ type: 'done' });
      }

      if (/swap issue|swap.*(fail|stuck|problem|error)/.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await tool('swap', emit, signal, 500);
        await say(
          'Swaps can fail when the price moves past your slippage limit or when there is not enough native coin for ' +
            'fees. Try again with a slightly smaller amount, and check you hold some native coin for gas.',
          emit,
          signal
        );
        emit({ type: 'action', action: { kind: 'open_swap', label: 'Open Swap' } });
        return emit({ type: 'done' });
      }

      // 4. portfolio / balances
      if (/portfolio|my balance|total balance|how much (do i|have i)|what do i (own|have)|holdings/.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await tool('wallet-address', emit, signal, 450);
        const total = holdingsTotal(ctx);
        const rows = [...ctx.holdings]
          .sort((a, b) => b.amount * b.price - a.amount * a.price)
          .map((h) => `${h.symbol}: ${h.amount} (${usd(h.amount * h.price)})`)
          .join('\n');
        await say(`Your wallet holds ${usd(total)} in total:\n\n${rows}`, emit, signal);
        return emit({ type: 'done' });
      }

      // 5. receive
      if (/receive|my address|deposit address|where (do|can) i (get|receive)/.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await tool('wallet-address', emit, signal, 450);
        await say(
          'Open Receive to see your address and QR code. For privacy Veltravia uses a fresh address for each ' +
            'receive, so never reuse an old one.',
          emit,
          signal
        );
        emit({ type: 'action', action: { kind: 'open_receive', label: 'Open Receive' } });
        return emit({ type: 'done' });
      }

      // 6. swap
      if (/\b(swap|exchange|convert|trade)\b/.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await tool('swap', emit, signal);
        await say(
          'I can open Swap for you. I do not execute swaps from the chat, you review the quote and confirm ' +
            'it yourself.',
          emit,
          signal
        );
        emit({ type: 'action', action: { kind: 'open_swap', label: 'Open Swap' } });
        return emit({ type: 'done' });
      }

      // 7. trending / gainers / losers
      if (/trending|gainers?|losers?|top (coins|movers)|hot/.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await tool('trending', emit, signal);
        const wantLosers = /losers?/.test(lower);
        const sorted = [...MARKET_COINS].sort((a, b) =>
          wantLosers ? a.change24h - b.change24h : b.change24h - a.change24h
        );
        const top = sorted.slice(0, 4);
        await say(
          `${wantLosers ? 'Biggest losers' : 'Biggest gainers'} over the last 24 hours:\n\n` +
            top.map((c) => `${c.name} (${c.symbol}): ${c.change24h >= 0 ? '+' : ''}${c.change24h.toFixed(2)}%`).join('\n') +
            '\n\nPast moves do not predict what happens next.',
          emit,
          signal
        );
        return emit({ type: 'done' });
      }

      // 8. price / info for a coin
      const coin = findCoin(text);
      if (coin && /price|worth|cost|how much is|info|about|what is|safe|news/.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        if (/safe|scam|rug|legit/.test(lower)) {
          await tool('asset-security', emit, signal);
          await say(
            `${coin.name} (${coin.symbol}) is a widely traded, well-established asset. I can't give a guarantee ` +
              'on any token. Always verify the contract address, check liquidity, and be careful with unknown tokens.',
            emit,
            signal
          );
        } else if (/news/.test(lower)) {
          await tool('market-news', emit, signal);
          await say(
            `I don't have a live news feed connected yet, so I can't summarise recent ${coin.symbol} headlines. ` +
              `${coin.name} is currently ${usd(coin.priceUsd)}, ${coin.change24h >= 0 ? 'up' : 'down'} ` +
              `${Math.abs(coin.change24h).toFixed(2)}% in 24 hours.`,
            emit,
            signal
          );
        } else {
          await tool('asset-info', emit, signal);
          await say(
            `${coin.name} (${coin.symbol}) is trading at ${usd(coin.priceUsd)}, ` +
              `${coin.change24h >= 0 ? 'up' : 'down'} ${Math.abs(coin.change24h).toFixed(2)}% over 24 hours. ` +
              `Market cap is about $${(coin.marketCap / 1e9).toFixed(1)}B.`,
            emit,
            signal
          );
        }
        return emit({ type: 'done' });
      }

      // 9. address / website safety
      if (/0x[0-9a-fA-F]{40}/.test(text) && /safe|scam|check|legit/.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await tool('address-security', emit, signal);
        await say(
          "I can't confirm whether an address is safe from here, because I have no live blocklist connected yet. " +
            'Treat any address a stranger gave you as untrusted, and send a small test amount first.',
          emit,
          signal
        );
        return emit({ type: 'done' });
      }
      if (/https?:\/\/|www\./.test(lower) && /safe|scam|legit|check/.test(lower)) {
        emit({ type: 'THINKING_STOPPED' });
        await tool('website-security', emit, signal);
        await say(
          "I can't verify websites yet. Never connect your wallet or enter your recovery phrase on a site you " +
            'reached through a link from a stranger or an ad.',
          emit,
          signal
        );
        return emit({ type: 'done' });
      }

      // 10. predictions / advice
      if (PREDICT_RE.test(text)) {
        emit({ type: 'THINKING_STOPPED' });
        await say(
          "I can't predict prices or tell you what to buy. Crypto is volatile and anything can happen. I can " +
            'show you the facts: current prices, 24-hour moves and how your portfolio is doing.',
          emit,
          signal
        );
        return emit({ type: 'done' });
      }

      // 11. fallback
      emit({ type: 'THINKING_STOPPED' });
      await say(
        'I can help with your balances, prices and market moves, sending crypto, swaps, receiving, and problems ' +
          'with your wallet. For example: "Send $20 of ETH to 0x…" or "How is my portfolio doing?"',
        emit,
        signal
      );
      emit({
        type: 'action',
        action: {
          kind: 'quick_reply',
          replies: [
            { label: 'How is my portfolio doing?', send: 'How is my portfolio doing?' },
            { label: 'Biggest gainers now', send: 'What are the biggest gainers right now?' },
          ],
        },
      });
      emit({ type: 'done' });
    } catch (e) {
      emit({ type: 'THINKING_STOPPED' });
      emit({ type: 'error', code: 'UNKNOWN', message: 'Something went wrong. Please try again.' });
    }
  },

  async resolveConsent(request, allowed, ctx, emit, signal) {
    pendingConsent.delete(request.id);
    emit({ type: 'THINKING_STARTED' });
    await sleep(500);
    emit({ type: 'THINKING_STOPPED' });
    if (!allowed) {
      await say(
        "No problem, I won't check your wallet. You can describe the missing token and network and I'll guide you " +
          'from there.',
        emit,
        signal
      );
      return emit({ type: 'done' });
    }
    await tool('wallet-address', emit, signal, 600);
    const lines = ctx.holdings.map((h) => `${h.symbol}: ${h.amount}`).join('\n');
    await say(
      `I can see these balances on this wallet:\n\n${lines}\n\nIf the token you expected is not in this list, ` +
        'tell me its name and which network it was sent on. If it is listed but hidden in Home, open Filters and ' +
        'turn on "Show small balances".',
      emit,
      signal
    );
    emit({ type: 'done' });
  },
};
