/**
 * What a scanned code means (Trust's UniversalQRUriParser, reproduced).
 *
 * The scanner does not just decode a string, it classifies it:
 *   - a bare address                     0x… / bc1…
 *   - an EIP-681 payment URI             ethereum:0x…@1/transfer?address=…&uint256=…
 *   - a CAIP-10 / CAIP-19 asset URI      eip155:1/erc20:0x…  /  eip155:1/slip44:60
 *   - a WalletConnect pairing URI        wc:…@2?relay-protocol=…
 *   - a plain link                       https://…
 *   - anything else                      text (not a wallet instruction)
 *
 * Pure and side-effect free: ScanQrScreen decides what to do with the result.
 */

export type QrKind = 'evm-address' | 'payment' | 'asset' | 'walletconnect' | 'url' | 'text';

export interface ParsedQr {
  kind: QrKind;
  /** The value a screen should consume (address for payments, URL for links). */
  value: string;
  /** Chain id when the code names one (1 = Ethereum, 56 = BSC, 137 = Polygon). */
  chainId?: number;
  /** ERC-20 / token contract from a CAIP-19 asset URI or a token transfer. */
  token?: string;
  /** Amount in the token's base units, as written in the URI. */
  amount?: string;
  /** Short human summary for the result sheet. */
  label: string;
  /** Secondary line: chain name, or why the code is unusable. */
  detail: string;
}

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const CHAIN_NAMES: Record<number, string> = { 1: 'Ethereum', 56: 'BNB Chain', 137: 'Polygon', 8453: 'Base', 42161: 'Arbitrum' };

/** Chain label for a CAIP-2 id. */
export function chainName(id?: number): string {
  if (id == null) return '';
  return CHAIN_NAMES[id] ?? `Chain ${id}`;
}

export function parseQr(raw: string): ParsedQr {
  const text = (raw ?? '').trim();
  if (!text) return { kind: 'text', value: text, label: 'Empty code', detail: 'Nothing was encoded in that QR.' };

  // bare address
  if (EVM_ADDRESS.test(text)) {
    return { kind: 'evm-address', value: text, label: 'Wallet address', detail: shorten(text) };
  }

  // WalletConnect pairing
  if (/^wc:/i.test(text)) {
    return { kind: 'walletconnect', value: text, label: 'WalletConnect', detail: 'Connect this app to a dApp' };
  }

  // EIP-681: ethereum:<target>@<chain>[/<function>]?<params>
  const eip681 = /^(ethereum|eip155):([^?]*)(\?.*)?$/i.exec(text);
  if (eip681) {
    const [, scheme, body, query = ''] = eip681;
    const [targetPart, chainPart] = body.split('@');
    const chainId = chainPart ? Number(chainPart.replace(/\/.*$/, '')) : scheme.toLowerCase() === 'ethereum' ? 1 : undefined;
    const params = new URLSearchParams(query.replace(/^\?/, ''));
    const to = params.get('address') ?? appTarget(targetPart);
    // a token transfer names the contract either as the target
    // (ethereum:<contract>@1/transfer?address=<to>) or in the path
    const hasTransferFn = /\/(transfer|erc20)/i.test(body);
    const token = tokenFromTarget(targetPart) ?? (hasTransferFn ? appTarget(targetPart) : undefined);
    const amount = params.get('uint256') ?? params.get('value') ?? undefined;
    if (to && EVM_ADDRESS.test(to)) {
      return {
        kind: token ? 'asset' : 'payment',
        value: to,
        chainId: Number.isFinite(chainId) ? chainId : undefined,
        token,
        amount,
        label: token ? 'Token transfer' : 'Payment request',
        detail: [chainName(Number.isFinite(chainId) ? chainId : undefined), shorten(to)].filter(Boolean).join(' · '),
      };
    }
  }

  // CAIP-19 asset / CAIP-10 account: eip155:1/erc20:0x…
  const caip = /^eip155:(\d+)(?:\/(?:erc20|slip44):(.+))?$/i.exec(text);
  if (caip) {
    const chainId = Number(caip[1]);
    const token = caip[2];
    return {
      kind: token && EVM_ADDRESS.test(token) ? 'asset' : 'payment',
      value: token && EVM_ADDRESS.test(token) ? token : text,
      chainId,
      token: token && EVM_ADDRESS.test(token) ? token : undefined,
      label: 'Asset',
      detail: chainName(chainId),
    };
  }

  // plain link
  if (/^https?:\/\/\S+$/i.test(text)) {
    let host = text;
    try { host = new URL(text).host; } catch { /* keep raw */ }
    return { kind: 'url', value: text, label: 'Link', detail: host };
  }

  return { kind: 'text', value: text, label: 'Not a wallet code', detail: 'This QR does not contain an address, payment or link.' };
}

/** True when the code is something a wallet screen could act on. */
export function isActionable(p: ParsedQr): boolean {
  return p.kind !== 'text';
}

function appTarget(targetPart: string): string | undefined {
  // ethereum:pay-0x… / ethereum:0x… — the target is the last path-ish token
  const cleaned = targetPart.replace(/^pay-/i, '').replace(/\/.*$/, '').trim();
  return EVM_ADDRESS.test(cleaned) ? cleaned : undefined;
}

function tokenFromTarget(targetPart: string): string | undefined {
  const m = /\/(?:erc20|token)[:/](0x[a-fA-F0-9]{40})/i.exec(targetPart);
  return m ? m[1] : undefined;
}

function shorten(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
