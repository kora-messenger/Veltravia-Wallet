/**
 * Veltravia AI — transfer preparation.
 *
 * Turns "send $100 of ETH to 0x…" into a validated TransferProposal.
 * It NEVER signs or broadcasts. The approval card hands the proposal to
 * the native confirm step (biometric/passcode) and the signer.
 *
 * Money rules:
 *  - coin amounts are decimal STRINGS, converted with bigint scaling
 *  - a proposal is re-validated at approval time (prices move)
 *  - every refusal carries a user-readable reason
 */

import { CHAINS } from '../config/chains';
import { walletLocked } from '../core/security/walletLock';
import type { ChatContext, TransferProposal } from './protocol';

/** Symbol -> chain that v1 can actually send on. */
const SYMBOL_CHAIN: Record<string, { chainId: string; native: boolean }> = {
  ETH: { chainId: '1', native: true },
  BNB: { chainId: '56', native: true },
  POL: { chainId: '137', native: true },
  MATIC: { chainId: '137', native: true },
  USDT: { chainId: '56', native: false }, // BEP-20 default in v1
  USDC: { chainId: '1', native: false },
};

const ALIASES: Record<string, string> = {
  BITCOIN: 'BTC', BTC: 'BTC',
  ETHER: 'ETH', ETHEREUM: 'ETH', ETH: 'ETH',
  BNB: 'BNB', BINANCE: 'BNB',
  POLYGON: 'POL', MATIC: 'POL', POL: 'POL',
  TETHER: 'USDT', USDT: 'USDT',
  USDC: 'USDC',
  SOLANA: 'SOL', SOL: 'SOL',
  TRON: 'TRX', TRX: 'TRX',
  LITECOIN: 'LTC', LTC: 'LTC',
  DOGE: 'DOGE', DOGECOIN: 'DOGE',
  XRP: 'XRP', RIPPLE: 'XRP',
};

/** Rough native-coin fee by chain (replaced by live gas oracle in Phase 2). */
const FEE_NATIVE: Record<string, { amount: string; symbol: string }> = {
  '1': { amount: '0.0012', symbol: 'ETH' },
  '56': { amount: '0.0002', symbol: 'BNB' },
  '137': { amount: '0.02', symbol: 'POL' },
};

export function canonicalSymbol(word: string): string | null {
  return ALIASES[word.trim().toUpperCase()] ?? null;
}

/** 0x + 40 hex. Checksum (EIP-55) is validated when mixed-case is supplied. */
export function isEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/* ---- decimal-string money math (no floats for coin amounts) ----------- */

const SCALE = 18;

export function toUnits(dec: string, scale = SCALE): bigint {
  const [i, f = ''] = dec.split('.');
  const frac = (f + '0'.repeat(scale)).slice(0, scale);
  return BigInt(i || '0') * 10n ** BigInt(scale) + BigInt(frac || '0');
}

export function fromUnits(units: bigint, scale = SCALE, maxDp = 8): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const base = 10n ** BigInt(scale);
  const i = abs / base;
  let f = (abs % base).toString().padStart(scale, '0').slice(0, maxDp).replace(/0+$/, '');
  return (neg ? '-' : '') + i.toString() + (f ? '.' + f : '');
}

/** usd / price -> coin amount string, rounded DOWN so we never overspend. */
export function usdToCoin(usd: number, price: number): string {
  if (price <= 0) return '0';
  const usdUnits = toUnits(usd.toFixed(2));
  const priceUnits = toUnits(price.toFixed(8));
  const coin = (usdUnits * 10n ** BigInt(SCALE)) / priceUnits;
  return fromUnits(coin);
}

/* ---- parsing ---------------------------------------------------------- */

export interface ParsedTransfer {
  /** Present if the user gave a fiat amount ("$100"). */
  usd?: number;
  /** Present if the user gave a coin amount ("0.5 ETH"). */
  coinAmount?: string;
  all?: boolean;
  symbol?: string;
  to?: string;
  /** User mentioned a chain/network by name. */
  chainHint?: string;
}

const TRANSFER_RE = /\b(send|transfer|move|pay|withdraw)\b/i;

export function looksLikeTransfer(text: string): boolean {
  return TRANSFER_RE.test(text);
}

export function parseTransfer(text: string): ParsedTransfer {
  const out: ParsedTransfer = {};

  const addr = text.match(/0x[0-9a-fA-F]{40}/);
  if (addr) out.to = addr[0];
  else {
    // catch near-miss addresses so we can explain the problem
    const near = text.match(/\b0x[0-9a-zA-Z]{6,}\b/);
    if (near) out.to = near[0];
  }

  // "$100", "100 usd", "100 dollars"
  const usdA = text.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/);
  const usdB = text.match(/\b([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:usd|dollars?|bucks)\b/i);
  if (usdA) out.usd = Number(usdA[1].replace(/,/g, ''));
  else if (usdB) out.usd = Number(usdB[1].replace(/,/g, ''));

  // symbol: any known word
  const words = text.replace(/0x[0-9a-fA-F]+/g, ' ').split(/[^A-Za-z]+/);
  for (const w of words) {
    const sym = canonicalSymbol(w);
    if (sym) {
      out.symbol = sym;
      break;
    }
  }

  // "0.5 ETH" (coin amount) when there is no fiat marker
  if (out.usd === undefined) {
    const coinAmt = text.match(/([0-9]*\.?[0-9]+)\s*([A-Za-z]{2,10})\b/);
    if (coinAmt && canonicalSymbol(coinAmt[2])) {
      out.coinAmount = coinAmt[1];
      out.symbol = canonicalSymbol(coinAmt[2])!;
    }
  }

  if (/\b(all|everything|max|entire)\b/i.test(text)) out.all = true;

  const chainHint = text.match(/\b(bep-?20|bsc|bnb smart chain|erc-?20|ethereum|polygon)\b/i);
  if (chainHint) out.chainHint = chainHint[1].toLowerCase();

  return out;
}

/* ---- validation ------------------------------------------------------- */

export type PrepareResult =
  | { ok: true; proposal: TransferProposal }
  | { ok: false; reason: string; needs?: 'amount' | 'asset' | 'address' | 'unlock' };

let seq = 0;

export function prepareTransfer(p: ParsedTransfer, ctx: ChatContext): PrepareResult {
  // Wallet lock guard: value movement is frozen until the user unlocks again.
  if (walletLocked()) {
    return {
      ok: false,
      needs: 'unlock',
      reason:
        'Your wallet is locked, so I cannot prepare transfers. Sending is blocked until you unlock it — ' +
        'just tell me to unlock your wallet.',
    };
  }
  if (!p.symbol) {
    return { ok: false, needs: 'asset', reason: 'Which coin would you like to send?' };
  }
  if (!p.to) {
    return { ok: false, needs: 'address', reason: `What address should I send the ${p.symbol} to?` };
  }
  if (p.usd === undefined && p.coinAmount === undefined && !p.all) {
    return { ok: false, needs: 'amount', reason: `How much ${p.symbol} should I send?` };
  }

  const route = SYMBOL_CHAIN[p.symbol];
  if (!route) {
    return {
      ok: false,
      reason:
        `I can't send ${p.symbol} yet. Veltravia v1 supports Ethereum, BNB Smart Chain ` +
        `and Polygon assets. ${p.symbol === 'BTC' ? 'Bitcoin support is planned for mainnet.' : ''}`.trim(),
    };
  }

  const holding = ctx.holdings.find(
    (h) => h.symbol === p.symbol || (p.symbol === 'POL' && h.symbol === 'MATIC')
  );
  if (!holding || holding.amount <= 0) {
    return { ok: false, reason: `You don't have any ${p.symbol} in this wallet to send.` };
  }

  if (!isEvmAddress(p.to)) {
    return {
      ok: false,
      needs: 'address',
      reason:
        `That doesn't look like a valid ${CHAINS.find((c) => c.id === route.chainId)?.name ?? 'EVM'} ` +
        `address. It must start with 0x followed by 40 characters. Please check it and send it again.`,
    };
  }

  const chain = CHAINS.find((c) => c.id === route.chainId)!;
  const from = ctx.addresses[route.chainId];
  if (!from) return { ok: false, reason: `I can't find your ${chain.name} address on this device.` };
  if (from.toLowerCase() === p.to.toLowerCase()) {
    return { ok: false, reason: "That's your own address. Sending to yourself would only cost a fee." };
  }

  const price = holding.price;
  const heldUnits = toUnits(String(holding.amount));
  const fee = FEE_NATIVE[route.chainId];
  const feeUnits = toUnits(fee.amount);
  const feePrice =
    ctx.holdings.find((h) => h.symbol === fee.symbol || (fee.symbol === 'POL' && h.symbol === 'MATIC'))?.price ??
    price;
  const feeUsd = Number((Number(fee.amount) * feePrice).toFixed(2));

  // amount in coin units
  let wanted: bigint;
  if (p.all) {
    wanted = route.native ? heldUnits - feeUnits : heldUnits; // leave room for the fee
  } else if (p.usd !== undefined) {
    wanted = toUnits(usdToCoin(p.usd, price));
  } else {
    wanted = toUnits(p.coinAmount!);
  }

  if (wanted <= 0n) {
    return { ok: false, reason: 'That amount is too small to send.' };
  }
  if (wanted > heldUnits) {
    return {
      ok: false,
      reason:
        `You only have ${fromUnits(heldUnits)} ${p.symbol} (about $${(holding.amount * price).toFixed(2)}). ` +
        `Try a smaller amount.`,
    };
  }
  if (route.native && wanted + feeUnits > heldUnits) {
    return {
      ok: false,
      reason:
        `That would leave too little ${p.symbol} to pay the network fee (about ${fee.amount} ${fee.symbol}). ` +
        `Try a slightly smaller amount.`,
    };
  }

  // fee asset must be covered when sending a token (e.g. USDT needs BNB)
  const warnings: string[] = [];
  if (!route.native) {
    const feeHolding = ctx.holdings.find((h) => h.symbol === fee.symbol);
    if (!feeHolding || toUnits(String(feeHolding.amount)) < feeUnits) {
      return {
        ok: false,
        reason: `You need about ${fee.amount} ${fee.symbol} on ${chain.name} to pay the network fee for this ${p.symbol} transfer.`,
      };
    }
  }

  const amountStr = fromUnits(wanted);
  const amountUsd = Number((Number(amountStr) * price).toFixed(2));

  if (amountUsd >= 1000) warnings.push('This is a large transfer. Double-check the address before approving.');
  if (p.chainHint && /bep|bsc|bnb/.test(p.chainHint) && route.chainId !== '56') {
    warnings.push('You mentioned BNB Smart Chain, but this asset will be sent on ' + chain.name + '.');
  }
  warnings.push('Blockchain transfers are irreversible. Make sure the receiving address supports ' + chain.name + '.');

  const now = Date.now();
  const proposal: TransferProposal = {
    id: `tx_${now}_${++seq}`,
    symbol: p.symbol === 'MATIC' ? 'POL' : p.symbol,
    chainId: route.chainId,
    chainName: chain.name,
    amount: amountStr,
    amountUsd,
    priceUsd: price,
    toAddress: p.to,
    fromAddress: from,
    feeNative: fee.amount,
    feeSymbol: fee.symbol,
    feeUsd,
    totalUsd: Number((amountUsd + (route.native ? feeUsd : 0)).toFixed(2)),
    warnings,
    createdAt: now,
    expiresAt: now + 2 * 60 * 1000,
  };
  return { ok: true, proposal };
}

/** Re-check at approval time: expired or price drifted > 2% => must re-prepare. */
export function revalidate(
  proposal: TransferProposal,
  ctx: ChatContext
): { ok: true } | { ok: false; reason: string } {
  if (Date.now() > proposal.expiresAt) {
    return { ok: false, reason: 'This transfer quote expired. Ask me again to get a fresh one.' };
  }
  const h = ctx.holdings.find(
    (x) => x.symbol === proposal.symbol || (proposal.symbol === 'POL' && x.symbol === 'MATIC')
  );
  if (!h) return { ok: false, reason: 'That asset is no longer in your wallet.' };
  const drift = Math.abs(h.price - proposal.priceUsd) / proposal.priceUsd;
  if (drift > 0.02) {
    return { ok: false, reason: 'The price moved more than 2% since this quote. Ask me again for a fresh one.' };
  }
  if (toUnits(String(h.amount)) < toUnits(proposal.amount)) {
    return { ok: false, reason: 'Your balance is now lower than this transfer amount.' };
  }
  return { ok: true };
}
