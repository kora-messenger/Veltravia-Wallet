/**
 * Veltravia AI — wire protocol.
 *
 * Mirrors the shape Trust Wallet's assistant uses (verified from its APK):
 *   - streamed text deltas
 *   - THINKING_STARTED / THINKING_STOPPED
 *   - tool_call progress ("Looking up asset info...")
 *   - structured ACTIONS rendered as tappable cards/chips
 *   - consent requests before the AI reads wallet data
 *
 * The local engine and the future hosted WebSocket gateway both emit this
 * exact event stream, so swapping the brain never touches the UI.
 */

export type ToolName =
  | 'asset-info'
  | 'market-news'
  | 'trending'
  | 'wallet-address'
  | 'asset-security'
  | 'address-security'
  | 'website-security'
  | 'buy-quote'
  | 'swap'
  | 'transfer';

export const TOOL_LABEL: Record<ToolName, string> = {
  'asset-info': 'Looking up asset info...',
  'market-news': 'Fetching market news...',
  trending: 'Checking trending tokens...',
  'wallet-address': 'Reading wallet address...',
  'asset-security': 'Checking asset security...',
  'address-security': 'Checking address security...',
  'website-security': 'Checking website security...',
  'buy-quote': 'Preparing buy quote...',
  swap: 'Preparing swap...',
  transfer: 'Preparing transfer...',
};

/** What a transfer proposal looks like once validated. Nothing is sent yet. */
export interface TransferProposal {
  id: string;
  symbol: string;
  chainId: string;
  chainName: string;
  /** Coin amount to send, as a decimal string (never a float for money). */
  amount: string;
  /** USD value at proposal time. */
  amountUsd: number;
  priceUsd: number;
  toAddress: string;
  fromAddress: string;
  /** Estimated network fee in the chain's native coin + USD. */
  feeNative: string;
  feeSymbol: string;
  feeUsd: number;
  /** Total debited in USD (amount + fee when fee is paid in the same coin). */
  totalUsd: number;
  /** Warnings the user must see before approving. */
  warnings: string[];
  createdAt: number;
  /** Proposal expires; price and fee are re-validated at approval. */
  expiresAt: number;
}

export type ActionKind =
  | 'transfer_approval'
  | 'open_swap'
  | 'open_receive'
  | 'open_activity'
  | 'quick_reply'
  | 'talk_to_support';

export interface QuickReply {
  label: string;
  /** Text sent as the user's message when tapped. */
  send: string;
}

export type ChatAction =
  | { kind: 'transfer_approval'; proposal: TransferProposal }
  | { kind: 'open_swap'; label: string; from?: string; to?: string }
  | { kind: 'open_receive'; label: string; symbol?: string }
  | { kind: 'open_activity'; label: string }
  | { kind: 'quick_reply'; replies: QuickReply[] }
  | { kind: 'talk_to_support'; label: string };

/** Consent card shown before the AI reads anything from the wallet. */
export interface ConsentRequest {
  id: string;
  wallet: string;
  networks: number;
  access: string;
  scope: string;
  footnote: string;
  /** What the engine should do when the user allows. */
  resumeIntent: string;
}

export type AiEvent =
  | { type: 'THINKING_STARTED' }
  | { type: 'THINKING_STOPPED' }
  | { type: 'tool_call'; tool: ToolName; label: string }
  | { type: 'text_delta'; text: string }
  | { type: 'action'; action: ChatAction }
  | { type: 'consent'; request: ConsentRequest }
  | { type: 'done' }
  | { type: 'error'; code: 'RATE_LIMITED' | 'OFFLINE' | 'UNKNOWN'; message: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Actions/consent attached to this assistant message. */
  actions: ChatAction[];
  consent?: ConsentRequest;
  /** Tool progress line currently shown (cleared when text arrives). */
  toolLabel?: string;
  streaming?: boolean;
  /** consent/approval resolution so a card cannot be used twice. */
  resolved?: 'allowed' | 'declined' | 'approved' | 'rejected' | 'expired';
  createdAt: number;
}

export interface ChatContext {
  /** The wallet's receive address on each chain id. */
  addresses: Record<string, string>;
  holdings: { symbol: string; amount: number; price: number; change24h: number }[];
  currency: 'USD';
  locale: string;
}

/** Every brain (local engine, hosted gateway) implements this. */
export interface AiBrain {
  send(
    userText: string,
    history: ChatMessage[],
    ctx: ChatContext,
    emit: (e: AiEvent) => void,
    signal: { aborted: boolean }
  ): Promise<void>;
  /** User answered a consent card. */
  resolveConsent(
    request: ConsentRequest,
    allowed: boolean,
    ctx: ChatContext,
    emit: (e: AiEvent) => void,
    signal: { aborted: boolean }
  ): Promise<void>;
}

export const DISCLAIMER = 'AI-generated content. Not financial advice.';
export const MENU_DISCLAIMER =
  'AI-generated content is for informational purposes only and may be inaccurate. Not financial advice.';
