import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', brandGradient: ['#6C63FF', '#4A90D9'], background: '#FFFFFF', surface: '#F5F5F7' } }),
}));
jest.mock('../src/components/Toast', () => ({ showToast: jest.fn() }));
jest.mock('../src/services/livePrices', () => ({
  ...jest.requireActual('../src/services/livePrices'),   // the failure wording is real
  refreshPrices: jest.fn(),
}));
jest.mock('../src/core/storage/secureStorage', () => ({
  readSettings: jest.fn(async () => ({})),
  writeSettings: jest.fn(async () => ({})),
}));

import MarketsScreen from '../src/screens/MarketsScreen';
import { refreshPrices } from '../src/services/livePrices';
import { showToast } from '../src/components/Toast';

const mount = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <MarketsScreen />
      </SafeAreaProvider>,
    );
  });
  return tree;
};

describe('pull to refresh on Markets', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (showToast as jest.Mock).mockClear();
    (refreshPrices as jest.Mock).mockReset();
  });

  it('asks for live prices and stays quiet when the feed answers', async () => {
    (refreshPrices as jest.Mock).mockResolvedValue({ ok: true, quotes: [{ symbol: 'BTC', priceUsd: 1, change24h: 0 }] });
    const tree = await mount();
    const pull = tree.root.findAll((n) => n.props.refreshControl && n.props.refreshControl.props.onRefresh)[0];
    let done!: Promise<void>;
    await act(async () => { done = pull.props.refreshControl.props.onRefresh(); });
    await act(async () => { jest.advanceTimersByTime(700); await done; });

    expect(refreshPrices).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();
    await act(async () => { tree.unmount(); });
  });

  it('says so plainly when the feed is unreachable, and keeps the prices on screen', async () => {
    (refreshPrices as jest.Mock).mockResolvedValue({ ok: false, quotes: [], reason: 'offline' });
    const tree = await mount();
    const pull = tree.root.findAll((n) => n.props.refreshControl && n.props.refreshControl.props.onRefresh)[0];
    let done!: Promise<void>;
    await act(async () => { done = pull.props.refreshControl.props.onRefresh(); });
    await act(async () => { jest.advanceTimersByTime(700); await done; });

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(String((showToast as jest.Mock).mock.calls[0][0])).toMatch(/price feed|connection|offline/i);
    const rows = tree.root.findAll((n) => typeof n.props.children === 'string' && n.props.children === 'Bitcoin');
    expect(rows.length).toBeGreaterThan(0);   // the bundled list is still there
    await act(async () => { tree.unmount(); });
  });
});
