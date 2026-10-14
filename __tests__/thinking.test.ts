import { isMarketQuestion, runThinking, THINK_MS, TOOL_MS } from '../src/ai/thinking';

describe('thinking choreography', () => {
  it('classifies market questions', () => {
    expect(isMarketQuestion("What's going on with the market?")).toBe(true);
    expect(isMarketQuestion('What are the biggest market movers today?')).toBe(true);
    expect(isMarketQuestion("What's moving the crypto market?")).toBe(true);
    expect(isMarketQuestion('top crypto trends')).toBe(true);
  });
  it('keeps small talk and off-topic on thinking only', () => {
    expect(isMarketQuestion('Hi')).toBe(false);
    expect(isMarketQuestion('Hello there')).toBe(false);
    expect(isMarketQuestion('Who won the football match?')).toBe(false);
    expect(isMarketQuestion('How do I send ETH?')).toBe(false);
  });

  it('small talk: waits ~2s with no tool line', async () => {
    jest.useFakeTimers();
    const events: any[] = [];
    let done = false;
    runThinking('Hi', (e) => events.push(e), { aborted: false }).then(() => (done = true));
    await jest.advanceTimersByTimeAsync(THINK_MS - 1);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(2);
    expect(done).toBe(true);
    expect(events).toEqual([]);
    jest.useRealTimers();
  });

  it('market: thinking then Checking trending tokens... then reply', async () => {
    jest.useFakeTimers();
    const events: any[] = [];
    let done = false;
    runThinking("what's going on with the market", (e) => events.push(e), { aborted: false }).then(() => (done = true));
    await jest.advanceTimersByTimeAsync(THINK_MS + 1);
    expect(events.map((e) => e.type)).toEqual(['THINKING_STOPPED', 'tool_call']);
    expect(events[1].label).toBe('Checking trending tokens...');
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(TOOL_MS + 1);
    expect(done).toBe(true);
    jest.useRealTimers();
  });
});
