import React from 'react';
import renderer, { act } from 'react-test-renderer';
import CandleChart from '../src/components/CandleChart';

const NOW = Date.UTC(2026, 9, 28, 8, 30);

const mount = async (props: Partial<React.ComponentProps<typeof CandleChart>> = {}) => {
  let t!: renderer.ReactTestRenderer;
  await act(async () => {
    t = renderer.create(
      <CandleChart seedKey="hyperliquid:BTC" last={81434} range="1D" interval="30m" now={NOW} interactive showVolume height={400} {...props} />,
    );
  });
  const root = t.root.find((x) => x.props.accessibilityLabel === 'Candle chart');
  await act(async () => { root.props.onLayout({ nativeEvent: { layout: { width: 400, height: 400 } } }); });
  return t;
};
const chart = (t: renderer.ReactTestRenderer) => t.root.find((x) => x.props.accessibilityLabel === 'Candle chart');
const axisLabels = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.props.children === 'string' && /^[\d,]+\.\d{2}$/.test(n.props.children)).map((n) => n.props.children as string);
const bodies = (t: renderer.ReactTestRenderer) =>
  t.root.findAll((n) => n.props.fill === '#158444' || n.props.fill === '#D63232').length;
const touch = (xs: number[]) => ({ nativeEvent: { touches: xs.map((x) => ({ pageX: x, pageY: 100 })), locationX: xs[0], pageX: xs[0] } });

describe('CandleChart gestures', () => {
  it('renders candles, volume bars, a price axis and the last-price tag', async () => {
    const t = await mount();
    expect(bodies(t)).toBeGreaterThan(20);
    expect(axisLabels(t).length).toBeGreaterThan(4);
    expect(axisLabels(t)).toContain('81,434.00'); // the purple tag
    await act(async () => { t.unmount(); });
  });

  it('dragging pans: the visible price axis changes as older candles come into view', async () => {
    const t = await mount();
    const before = axisLabels(t).join('|');
    await act(async () => { chart(t).props.onResponderGrant(touch([100])); });
    await act(async () => { chart(t).props.onResponderMove(touch([380])); });
    await act(async () => { chart(t).props.onResponderRelease(); });
    expect(axisLabels(t).join('|')).not.toBe(before);
    await act(async () => { t.unmount(); });
  });

  it('pinching out zooms in: fewer candles on screen; pinching in shows more', async () => {
    const t = await mount();
    const base = bodies(t);
    await act(async () => { chart(t).props.onResponderGrant(touch([150, 250])); });
    await act(async () => { chart(t).props.onResponderMove(touch([100, 300])); }); // fingers spread = zoom in
    await act(async () => { chart(t).props.onResponderRelease(); });
    expect(bodies(t)).toBeLessThan(base);
    await act(async () => { t.unmount(); });
  });

  it('zooming in re-fits the price scale to the visible candles (Trust 20s frame)', async () => {
    const t = await mount();
    const span = () => { const v = axisLabels(t).map((s) => parseFloat(s.replace(/,/g, ''))).filter((n) => n > 1000); return Math.max(...v) - Math.min(...v); };
    const wide = span();
    await act(async () => { chart(t).props.onResponderGrant(touch([150, 250])); });
    await act(async () => { chart(t).props.onResponderMove(touch([60, 340])); });
    await act(async () => { chart(t).props.onResponderRelease(); });
    expect(span()).toBeLessThan(wide);
    await act(async () => { t.unmount(); });
  });

  it('switching interval resets the window (new series)', async () => {
    const t = await mount();
    await act(async () => { chart(t).props.onResponderGrant(touch([100])); });
    await act(async () => { chart(t).props.onResponderMove(touch([390])); });
    await act(async () => { chart(t).props.onResponderRelease(); });
    await act(async () => { t.update(<CandleChart seedKey="hyperliquid:BTC" last={81434} range="1D" interval="1h" now={NOW} interactive showVolume height={400} />); });
    expect(bodies(t)).toBeGreaterThan(10);
    await act(async () => { t.unmount(); });
  });

  it('line mode draws a path instead of candles', async () => {
    const t = await mount({ line: true, showVolume: false });
    const candlesDrawn = t.root.findAll((n) => n.props.fill === '#158444' || n.props.fill === '#D63232').length;
    expect(candlesDrawn).toBe(0);
    await act(async () => { t.unmount(); });
  });

  it('the time axis labels use HH:mm and the day number at midnight', async () => {
    const t = await mount();
    const labels = t.root.findAll((n) => typeof n.props.children === 'string' && /^(\d{2}:\d{2}|\d{1,2})$/.test(n.props.children)).map((n) => n.props.children as string);
    expect(labels.length).toBeGreaterThan(1);
    await act(async () => { t.unmount(); });
  });
});
