/**
 * Veltravia Wallet — trend (line + area) chart for the Perps market page.
 *
 * Trust 10:08 recording behavior:
 *   rest   : green line, gradient area fill, solid dot on the newest point
 *   touch  : fill disappears, line coloured up to the finger and GREY after
 *            it, haloed dot under the finger; the parent header follows via
 *            onScrub (price, change since range start, date stamp)
 *   release: snaps back; onScrub(null)
 *
 * Touch-down scrubs immediately (no long-press), horizontal drag moves it.
 * Colour follows the range trend: green when the range is up, red when down.
 */
import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, GestureResponderEvent } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import {
  trendSeries, pointIndexAtX, scrubAt,
  type TrendRange, type TrendScrub,
} from '../services/trendEngine';

const GREEN = '#158444';
const RED = '#D63232';
const GREY = '#C9CBD3';
const GREY_DARK = '#4A4E63';
const PAD_X = 6;
const PAD_Y = 14;

export interface TrendChartProps {
  seedKey: string;
  last: number;
  range: TrendRange;
  height?: number;
  dark?: boolean;
  /** stable clock for tests */
  now?: number;
  onScrub?: (s: TrendScrub | null, range: TrendRange) => void;
  /** haptic tick as the finger crosses points (wired by the screen) */
  onTick?: () => void;
}

export default function TrendChart({
  seedKey, last, range, height = 300, dark = false, now, onScrub, onTick,
}: TrendChartProps) {
  const [w, setW] = useState(340);
  const [idx, setIdx] = useState<number | null>(null);
  const clock = useMemo(() => now ?? Date.now(), [now, seedKey, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const points = useMemo(() => trendSeries(seedKey, last, range, clock), [seedKey, last, range, clock]);

  const plotW = Math.max(40, w - PAD_X * 2);
  const plotH = height - PAD_Y * 2;
  const min = Math.min(...points.map((p) => p.price));
  const max = Math.max(...points.map((p) => p.price));
  const span = Math.max(1e-9, max - min);
  const xOf = (i: number) => PAD_X + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const yOf = (v: number) => PAD_Y + (1 - (v - min) / span) * plotH;

  const up = points[points.length - 1].price >= points[0].price;
  const color = up ? GREEN : RED;
  const grey = dark ? GREY_DARK : GREY;

  const path = (from: number, to: number) =>
    points.slice(from, to + 1).map((p, k) => `${k === 0 ? 'M' : 'L'}${xOf(from + k).toFixed(1)} ${yOf(p.price).toFixed(1)}`).join(' ');

  const scrubbing = idx != null;
  const cut = scrubbing ? idx! : points.length - 1;
  const lastIdx = useRef<number | null>(null);

  const update = (e: GestureResponderEvent) => {
    const i = pointIndexAtX(e.nativeEvent.locationX - PAD_X, plotW, points.length);
    if (i !== lastIdx.current) {
      lastIdx.current = i;
      setIdx(i);
      onTick?.();
      onScrub?.(scrubAt(points, i), range);
    }
  };
  const end = () => {
    lastIdx.current = null;
    setIdx(null);
    onScrub?.(null, range);
  };

  const dotX = xOf(cut);
  const dotY = yOf(points[cut].price);

  return (
    <View
      accessibilityLabel="Trend chart"
      style={[styles.wrap, { height }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={update}
      onResponderMove={update}
      onResponderRelease={end}
      onResponderTerminate={end}
    >
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={dark ? 0.28 : 0.2} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* area fill: rest only (it disappears while scrubbing) */}
        {!scrubbing && (
          <Path
            d={`${path(0, points.length - 1)} L${xOf(points.length - 1).toFixed(1)} ${height} L${xOf(0).toFixed(1)} ${height} Z`}
            fill="url(#trendFill)"
          />
        )}

        {/* the part AFTER the finger is grey */}
        {scrubbing && cut < points.length - 1 && (
          <Path d={path(cut, points.length - 1)} stroke={grey} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {/* coloured part: start -> finger (or whole line at rest) */}
        <Path d={path(0, cut)} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {/* dot (+ halo while scrubbing) */}
        {scrubbing && <Circle cx={dotX} cy={dotY} r={11} fill={color} fillOpacity={0.18} />}
        <Circle cx={dotX} cy={dotY} r={4} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
