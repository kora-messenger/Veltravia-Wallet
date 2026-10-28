/**
 * Veltravia Wallet — candlestick chart for the Perps market page.
 *
 * Deterministic candle series per market (seeded by symbol + timeframe) so
 * the chart is stable across renders until the real OHLC feed lands. Subtle
 * gridlines, green/red candles (Trust depth colors) and a dashed marker line
 * at the last price, with the price pill on the right edge.
 */
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Path, Line } from 'react-native-svg';

const GREEN = '#158444';
const RED = '#D63232';

export interface Candle { open: number; close: number; high: number; low: number }

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic candles ending exactly at `last` (the market's price). */
export function genCandles(seedKey: string, n: number, last: number): Candle[] {
  let seed = hash(seedKey) | 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: Candle[] = [];
  // walk backwards from `last`, then reverse so the final close is `last`
  let close = last;
  for (let i = 0; i < n; i++) {
    const drift = (rnd() - 0.48) * 0.022 * close;
    const open = close + drift;
    const hi = Math.max(open, close) * (1 + rnd() * 0.006);
    const lo = Math.min(open, close) * (1 - rnd() * 0.006);
    out.push({ open, close, high: hi, low: lo });
    close = open;
  }
  return out.reverse().map((c) => ({ ...c, close: c.close }));
}

export default function CandleChart({
  seedKey, last, height = 216, color = '#6C63FF',
}: { seedKey: string; last: number; height?: number; color?: string }) {
  const [w, setW] = useState(320);
  const candles = useMemo(() => genCandles(seedKey, 42, last), [seedKey, last]);

  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const pad = (max - min) * 0.08 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const y = (v: number) => ((hi - v) / (hi - lo)) * (height - 20) + 10;
  const step = w / (candles.length + 2);
  const bodyW = Math.max(2, step * 0.55);
  const lastY = y(last);

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => { const nw = e.nativeEvent.layout.width; if (nw > 0 && nw !== w) setW(nw); }}
    >
      <Svg width={w} height={height}>
        {/* faint gridlines */}
        {[0.15, 0.38, 0.61, 0.84].map((f) => (
          <Line key={f} x1={0} y1={height * f} x2={w} y2={height * f} stroke="#E7E7EC" strokeWidth={1} />
        ))}
        {candles.map((c, i) => {
          const x = step * (i + 1);
          const up = c.close >= c.open;
          const col = up ? GREEN : RED;
          const top = y(Math.max(c.open, c.close));
          const h = Math.max(1.5, Math.abs(y(c.open) - y(c.close)));
          return (
            <React.Fragment key={i}>
              <Path d={`M${x} ${y(c.high)} L${x} ${y(c.low)}`} stroke={col} strokeWidth={1} />
              <Rect x={x - bodyW / 2} y={top} width={bodyW} height={h} fill={col} />
            </React.Fragment>
          );
        })}
        {/* last price marker */}
        <Line x1={0} y1={lastY} x2={w - 54} y2={lastY} stroke={color} strokeWidth={1} strokeDasharray="4 4" />
        <Rect x={w - 54} y={lastY - 9} width={54} height={18} rx={4} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
