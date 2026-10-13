/**
 * Veltravia AI — transfer execution boundary.
 *
 * The AI only PREPARES a proposal. Execution happens here, after the user
 * approves AND authenticates (biometric or passcode). The chat layer never
 * touches keys; only this module talks to the wallet's signing layer.
 *
 * HONESTY RULE: if signing is not available (WalletCore native bridge not
 * bundled yet) we return `unavailable` and the UI says so. We never invent
 * a transaction hash or report a send that did not happen.
 */

import type { TransferProposal } from './protocol';

export type ExecuteResult =
  | { status: 'sent'; hash: string; explorerUrl?: string }
  | { status: 'unavailable'; message: string }
  | { status: 'failed'; message: string };

/** Implemented by the signing layer (WalletCore + backend relay). */
export interface TransferExecutor {
  /** True once the native signer and broadcast relay are wired. */
  isReady(): boolean;
  execute(proposal: TransferProposal): Promise<ExecuteResult>;
}

/** Default: not ready. Replaced via registerExecutor() when signing lands. */
let executor: TransferExecutor = {
  isReady: () => false,
  async execute() {
    return {
      status: 'unavailable',
      message:
        'Sending is not enabled in this build yet. Your funds were not moved and nothing was signed.',
    };
  },
};

export function registerExecutor(e: TransferExecutor) {
  executor = e;
}

export function signingReady(): boolean {
  return executor.isReady();
}

export async function executeTransfer(p: TransferProposal): Promise<ExecuteResult> {
  try {
    return await executor.execute(p);
  } catch (e) {
    return {
      status: 'failed',
      message: e instanceof Error ? e.message : 'The transfer could not be completed.',
    };
  }
}
