import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', background: '#FFFFFF', surface: '#F5F5F7' } }),
}));
const mockCheckOnline = jest.fn();
jest.mock('../src/services/connectivity', () => ({
  checkOnline: () => mockCheckOnline(),
  offlineMessage: () => 'offline',
}));

import ChartNeedsNetwork from '../src/components/ChartNeedsNetwork';
import { useOnlineGate } from '../src/hooks/useOnlineGate';

/** Tiny host so the hook can be driven without mounting a whole screen. */
function HookHost({ push }: { push: (v: any) => void }) {
  const online = useOnlineGate();
  push(online);
  return null;
}

const texts = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);

describe('chart area requires the network', () => {
  beforeEach(() => mockCheckOnline.mockReset());

  it('offline: says so, and offers a retry', async () => {
    const retry = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<ChartNeedsNetwork height={240} onRetry={retry} />); });

    const copy = texts(tree).join(' ');
    expect(copy).toMatch(/offline/i);
    expect(copy).toMatch(/Charts need a connection/i);

    const btn = tree.root.findAll((n) => n.props.accessibilityLabel === 'Retry loading the chart')[0];
    await act(async () => { btn.props.onPress(); });
    expect(retry).toHaveBeenCalledTimes(1);
    await act(async () => { tree.unmount(); });
  });

  it('the gate goes checking -> offline and back to online on recheck', async () => {
    mockCheckOnline.mockResolvedValue({ online: false, reason: 'offline' });
    let api: any;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => { tree = renderer.create(<HookHost push={(v) => { api = v; }} />); });
    expect(api.state).toBe('offline');

    mockCheckOnline.mockResolvedValue({ online: true });
    await act(async () => { await api.recheck(); });
    expect(api.state).toBe('online');
    await act(async () => { tree.unmount(); });
  });
});
