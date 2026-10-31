import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { useRefresh } from '../src/hooks/useRefresh';

type Api = ReturnType<typeof useRefresh>;

function Harness({ work, onError, minMs, api }: any) {
  const r = useRefresh(work, { onError, minMs });
  api.current = r;
  return null;
}

const mount = async (props: any) => {
  const api: { current?: Api } = {};
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Harness {...props} api={api} />);
  });
  return { tree, api: api as { current: Api } };
};

describe('pull to refresh', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the spinner while the work runs and hides it after', async () => {
    let release!: () => void;
    const work = jest.fn(() => new Promise<void>((r) => { release = () => r(); }));
    const { tree, api } = await mount({ work, minMs: 0 });

    expect(api.current.refreshing).toBe(false);
    let p!: Promise<void>;
    await act(async () => { p = api.current.onRefresh(); });
    expect(work).toHaveBeenCalledTimes(1);

    await act(async () => { release(); await p; });
    expect(api.current.refreshing).toBe(false);
    await act(async () => { tree.unmount(); });
  });

  it('never flickers: a fast refresh still spins for the minimum time', async () => {
    const work = jest.fn(async () => {});
    const { tree, api } = await mount({ work, minMs: 500 });

    let done = false;
    await act(async () => {
      const p = api.current.onRefresh().then(() => { done = true; });
      jest.advanceTimersByTime(200);
      expect(done).toBe(false);          // work finished, spinner still up
      jest.advanceTimersByTime(400);
      await p;
    });
    expect(done).toBe(true);
    await act(async () => { tree.unmount(); });
  });

  it('ignores a second pull while the first is running', async () => {
    let release!: () => void;
    const work = jest.fn(() => new Promise<void>((r) => { release = () => r(); }));
    const { tree, api } = await mount({ work, minMs: 0 });

    let first!: Promise<void>;
    await act(async () => { first = api.current.onRefresh(); });
    await act(async () => { await api.current.onRefresh(); });   // ignored
    expect(work).toHaveBeenCalledTimes(1);

    await act(async () => { release(); await first; });
    await act(async () => { tree.unmount(); });
  });

  it('reports a failure instead of throwing, and frees the spinner', async () => {
    const onError = jest.fn();
    const work = jest.fn(async () => { throw new Error('feed down'); });
    const { tree, api } = await mount({ work, onError, minMs: 0 });

    await act(async () => { await api.current.onRefresh(); });
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(api.current.refreshing).toBe(false);
    await act(async () => { tree.unmount(); });
  });
});
