/**
 * The candle box is never blank while it loads. (Ijezie, 31 Oct 2026: "the candle
 * view box have skeleton loading too".) It used to be an empty View while the
 * network was checked and a "···" spinner while candles were fetched.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ChartSkeleton, SkeletonBlock } from '../src/components/Skeleton';

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { mode: 'light', ink: '#0F111A', inkMuted: '#8A8EA3', brand: '#6C63FF', brandGradient: ['#6C63FF', '#4A90D9'], background: '#FFFFFF', surface: '#F5F5F7' } }),
}));

const render = async (el: React.ReactElement) => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(el); });
  return tree;
};

describe('ChartSkeleton (candle box loading)', () => {
  it('draws shimmer bars shaped like candles, not an empty box', async () => {
    const t = await render(<ChartSkeleton height={240} />);
    expect(t.root.findAll((n) => n.props.testID === 'chartSkeleton').length).toBeGreaterThan(0);
    // one wick + one body per bar
    expect(t.root.findAll((n) => n.type === SkeletonBlock).length).toBeGreaterThanOrEqual(12 * 2);
    // heights vary, so it reads as a chart rather than a solid block
    const flat = (style: any) => ([] as any[]).concat(style).filter(Boolean);
    const heights = t.root.findAll((n) => n.type === SkeletonBlock)
      .map((n) => Number(flat(n.props.style).slice(-1)[0]?.height))
      .filter((h) => Number.isFinite(h) && h > 0);
    expect(new Set(heights).size).toBeGreaterThan(3);
    await act(async () => { t.unmount(); });
  });

  it('fills the height it is given (the box keeps its size while loading)', async () => {
    const t = await render(<ChartSkeleton height={320} />);
    const box = t.root.find((n) => n.props.testID === 'chartSkeleton');
    const style = ([] as any[]).concat(box.props.style).filter(Boolean);
    const h = style.reduce((acc: number, s: any) => (s && s.height ? s.height : acc), 0);
    expect(h).toBe(320);
    await act(async () => { t.unmount(); });
  });

  it('no text, no spinner glyphs', async () => {
    const t = await render(<ChartSkeleton />);
    const strings = t.root.findAll((n) => typeof n.props.children === 'string');
    expect(strings.length).toBe(0);
    await act(async () => { t.unmount(); });
  });
});
