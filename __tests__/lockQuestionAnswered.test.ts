/**
 * The reported bug, end to end through the offline brain.
 *
 * Message: "Do you have the ability to lock my wallet to avoid others to send coin"
 * Expected: an honest spoken answer. NOT a "Lock your wallet" approval card.
 */
import { localBrain } from '../src/ai/engine';
import type { ChatContext } from '../src/ai/protocol';

jest.mock('../src/core/security/walletLock', () => ({
  __esModule: true,
  walletLocked: jest.fn(() => false),
  refreshWalletLock: jest.fn(async () => false),
  setWalletLocked: jest.fn(async () => {}),
}));

const ctx: ChatContext = {
  walletId: 'default',
  walletName: 'Main',
  balances: [{ symbol: 'ETH', amount: 1, usd: 3000 }],
  chainId: '1',
} as any;

async function run(text: string) {
  const events: any[] = [];
  const emit = (e: any) => events.push(e);
  await localBrain.send(text, [], ctx, emit, { aborted: false } as any);
  const textOut = events
    .filter((e) => e.type === 'text_delta' || e.type === 'text')
    .map((e) => e.text ?? '')
    .join('');
  const actions = events.filter((e) => e.type === 'action' && e.action?.kind === 'wallet_lock');
  return { events, textOut, actions };
}

describe('the wallet-lock question', () => {
  it('answers instead of opening a lock card', async () => {
    const { actions, textOut } = await run('Do you have the ability to lock my wallet to avoid others to send coin');
    expect(actions).toEqual([]);
    expect(textOut).toMatch(/Yes\. I can lock this wallet/);
    expect(textOut).toMatch(/not an on-chain lock/);
    expect(textOut).toMatch(/recovery phrase or private key can still move the funds/);
  });

  it('still opens the card for an actual request', async () => {
    const { actions } = await run('lock my wallet');
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toEqual({ kind: 'wallet_lock', lock: true });
  });

  it('does not lock the wallet when the user says not to', async () => {
    const { actions, textOut } = await run("don't lock my wallet");
    expect(actions).toEqual([]);
    expect(textOut).toMatch(/won't lock it/i);
  });
});
