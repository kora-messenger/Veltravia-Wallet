/**
 * Veltravia Wallet — interactive candle chart (Perps market page).
 *
 * Draws what candleEngine says is visible: candles, an optional volume
 * histogram, a right price axis (nice ticks, bold at the round tens), a
 * bottom time axis, the dashed last-price line with its purple tag, and a
 * long-press crosshair. Gestures (no extra native modules):
 *   - one finger drag  -> pan
 *   - two finger pinch -> zoom around the fingers
 *   - long press       -> crosshair + OHLC readout, drag to move it
 *
 * `interactive=false` renders the compact preview used on the market page
 * (no gestures, no volume); Advanced mode turns everything on.
 */
import React, { useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, GestureResponderEvent } from 'react-native';
import Svg, { Rect, Line, Path } from 'react-native-svg';
import {
  generateSeries, initialViewport, panViewport, zoomViewport, visibleSlice,
  fitPriceScale, niceTicks, formatAxisPrice, formatAxisTime, timeLabelIndices,
  candleAtX, type Candle, type Interval, type Range, type Viewport,
} from '../services/candleEngine';

const GREEN = '#158444';
const RED = '#D63232';
const VOL_GREEN = 'rgba(21,132,68,0.45)';
const VOL_RED = 'rgba(214,50,50,0.45)';
const AXIS_W = 64;
const TIME_H = 26;
const LONG_PRESS_MS = 350;

export interface CandleChartProps {
  seedKey: string;
  last: number;
  range: Range;
  interval: Interval;
  height?: number;
  /** pan / pinch / crosshair on? */
  interactive?: boolean;
  showVolume?: boolean;
  /** theme */
  dark?: boolean;
  brand?: string;
  /** stable clock for tests */
  now?: number;
  /** draw a line of closes instead of candles (the trend-icon toggle) */
  line?: boolean;
  onScrubChange?: (c: Candle | null) => void;
}

function dist(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

export default function CandleChart({
  seedKey, last, range, interval, height = 230, interactive = false, showVolume = false,
  dark = false, brand = '#6C63FF', now, line = false, onScrubChange,
}: CandleChartProps) {
  const [w, setW] = useState(340);
  const clock = useMemo(() => now ?? Date.now(), [now, seedKey, range, interval]); // eslint-disable-line react-hooks/exhaustive-deps
  const candles = useMemo(
    () => generateSeries(seedKey, last, range, interval, clock),
    [seedKey, last, range, interval, clock],
  );
  const [vp, setVp] = useState<Viewport>(() => initialViewport(candles.length));
  const [cross, setCross] = useState<number | null>(null); // candle index under the crosshair

  // new series (range / interval / market change) -> reset the window
  const seriesKey = `${seedKey}|${range}|${interval}|${candles.length}`;
  const lastKey = useRef(seriesKey);
  if (lastKey.current !== seriesKey) {
    lastKey.current = seriesKey;
    setVp(initialViewport(candles.length));
    setCross(null);
  }

  const plotW = Math.max(60, w - AXIS_W);
  const volH = showVolume ? Math.round(height * 0.2) : 0;
  const priceH = height - TIME_H - volH;

  const { first, items } = visibleSlice(candles, vp);
  const scale = fitPriceScale(items, last);
  const y = useCallback(
    (v: number) => ((scale.max - v) / (scale.max - scale.min)) * (priceH - 12) + 6,
    [scale.max, scale.min, priceH],
  );
  const slot = plotW / vp.count;
  const xOf = (i: number) => (i - vp.start + 0.5) * slot;
  const bodyW = Math.max(1.5, slot * 0.62);

  const ticks = niceTicks(scale.min, scale.max, interactive ? 8 : 5);
  const tickStep = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  const maxVol = Math.max(1, ...items.map((c) => c.volume));
  const lastY = y(last);
  const labelIdx = timeLabelIndices(items, first, interval, 4);

  /* ---- gestures ---------------------------------------------------------- */
  const g = useRef({
    mode: 'idle' as 'idle' | 'pan' | 'pinch' | 'cross',
    x0: 0, vp0: vp, d0: 0, timer: null as ReturnType<typeof setTimeout> | null, moved: false,
  });
  const vpRef = useRef(vp); vpRef.current = vp;
  const totalRef = useRef(candles.length); totalRef.current = candles.length;
  const plotRef = useRef(plotW); plotRef.current = plotW;

  const crossFromX = (locX: number) => {
    const idx = candleAtX(Math.max(0, Math.min(plotRef.current - 1, locX)), vpRef.current, plotRef.current, totalRef.current);
    setCross(idx);
    onScrubChange?.(candles[idx] ?? null);
  };

  const clearTimer = () => { if (g.current.timer) { clearTimeout(g.current.timer); g.current.timer = null; } };

  const onStart = (e: GestureResponderEvent) => {
    if (!interactive) return;
    const t = e.nativeEvent.touches;
    clearTimer();
    g.current.moved = false;
    if (t.length >= 2) {
      g.current.mode = 'pinch';
      g.current.d0 = dist(t[0], t[1]);
      g.current.vp0 = vpRef.current;
      return;
    }
    g.current.mode = 'pan';
    g.current.x0 = t[0].pageX;
    g.current.vp0 = vpRef.current;
    const locX = e.nativeEvent.locationX;
    g.current.timer = setTimeout(() => {
      if (!g.current.moved) { g.current.mode = 'cross'; crossFromX(locX); }
    }, LONG_PRESS_MS);
  };

  const onMove = (e: GestureResponderEvent) => {
    if (!interactive) return;
    const t = e.nativeEvent.touches;
    if (t.length >= 2) {
      clearTimer();
      if (g.current.mode !== 'pinch') { g.current.mode = 'pinch'; g.current.d0 = dist(t[0], t[1]); g.current.vp0 = vpRef.current; }
      const s = dist(t[0], t[1]) / (g.current.d0 || 1);
      const focal = ((t[0].pageX + t[1].pageX) / 2) - (e.nativeEvent.pageX - e.nativeEvent.locationX);
      setVp(zoomViewport(g.current.vp0, s, Math.max(0, Math.min(plotRef.current, focal)), plotRef.current, totalRef.current));
      return;
    }
    if (g.current.mode === 'cross') { crossFromX(e.nativeEvent.locationX); return; }
    if (g.current.mode === 'pan') {
      const dx = t[0].pageX - g.current.x0;
      if (Math.abs(dx) > 4) { g.current.moved = true; clearTimer(); }
      setVp(panViewport(g.current.vp0, dx, plotRef.current, totalRef.current));
    }
  };

  const onEnd = () => {
    clearTimer();
    if (g.current.mode === 'cross') { setCross(null); onScrubChange?.(null); }
    g.current.mode = 'idle';
  };

  const grid = dark ? 'rgba(255,255,255,0.08)' : '#ECECF0';
  const axisTxt = dark ? '#9FA3B8' : '#8E8E96';
  const ink = dark ? '#EDEDF5' : '#0F111A';
  const ch = cross != null ? candles[cross] : null;

  return (
    <View
      testID="candleChart"
      style={{ width: '100%', height }}
      onLayout={(e) => { const nw = e.nativeEvent.layout.width; if (nw > 0 && Math.abs(nw - w) > 0.5) setW(nw); }}
      onStartShouldSetResponder={() => interactive}
      onMoveShouldSetResponder={() => interactive}
      onResponderGrant={onStart}
      onResponderMove={onMove}
      onResponderRelease={onEnd}
      onResponderTerminate={onEnd}
      accessibilityLabel="Candle chart"
    >
      <Svg width={w} height={height}>
        {/* horizontal grid + price axis labels */}
        {ticks.map((tv) => (
          <Line key={`g${tv}`} x1={0} y1={y(tv)} x2={plotW} y2={y(tv)} stroke={grid} strokeWidth={1} strokeDasharray="3 4" />
        ))}
        {/* vertical grid at time labels */}
        {labelIdx.map((i) => (
          <Line key={`v${i}`} x1={xOf(i)} y1={0} x2={xOf(i)} y2={priceH + volH} stroke={grid} strokeWidth={1} strokeDasharray="3 4" />
        ))}

        {/* volume histogram */}
        {showVolume && items.map((c, k) => {
          const i = first + k;
          const bh = Math.max(1, (c.volume / maxVol) * (volH - 4));
          return (
            <Rect key={`vol${i}`} x={xOf(i) - bodyW / 2} y={priceH + volH - bh} width={bodyW} height={bh}
              fill={c.close >= c.open ? VOL_GREEN : VOL_RED} />
          );
        })}

        {/* line mode: close-to-close path */}
        {line && items.length > 1 && (
          <Path
            d={items.map((c, k) => `${k === 0 ? 'M' : 'L'}${xOf(first + k)} ${y(c.close)}`).join(' ')}
            stroke={items[items.length - 1].close >= items[0].close ? GREEN : RED}
            strokeWidth={2}
            fill="none"
          />
        )}

        {/* candles */}
        {!line && items.map((c, k) => {
          const i = first + k;
          const up = c.close >= c.open;
          const col = up ? GREEN : RED;
          const top = y(Math.max(c.open, c.close));
          const bh = Math.max(1.2, Math.abs(y(c.open) - y(c.close)));
          return (
            <React.Fragment key={`c${i}`}>
              <Path d={`M${xOf(i)} ${y(c.high)} L${xOf(i)} ${y(c.low)}`} stroke={col} strokeWidth={1} />
              <Rect x={xOf(i) - bodyW / 2} y={top} width={bodyW} height={bh} fill={col} />
            </React.Fragment>
          );
        })}

        {/* last price line */}
        <Line x1={0} y1={lastY} x2={plotW} y2={lastY} stroke={brand} strokeWidth={1} strokeDasharray="2 3" />

        {/* crosshair */}
        {ch && cross != null && (
          <>
            <Line x1={xOf(cross)} y1={0} x2={xOf(cross)} y2={priceH + volH} stroke={ink} strokeWidth={1} strokeDasharray="4 3" />
            <Line x1={0} y1={y(ch.close)} x2={plotW} y2={y(ch.close)} stroke={ink} strokeWidth={1} strokeDasharray="4 3" />
          </>
        )}
      </Svg>

      {/* right price axis */}
      <View style={[styles.axis, { width: AXIS_W, height: priceH }]} pointerEvents="none">
        {ticks.map((tv) => {
          const round = Math.abs(tv % (tickStep * 5)) < 1e-6;
          return (
            <Text key={`t${tv}`} style={[styles.axisText, { top: y(tv) - 8, color: round ? ink : axisTxt, fontFamily: round ? 'Inter-700' : 'Inter-500', fontWeight: round ? '700' : '500' }]}>
              {formatAxisPrice(tv, tickStep)}
            </Text>
          );
        })}
        <View style={[styles.tag, { top: lastY - 10, backgroundColor: brand }]}>
          <Text style={styles.tagText}>{formatAxisPrice(last, tickStep)}</Text>
        </View>
        {ch && cross != null && (
          <View style={[styles.tag, { top: y(ch.close) - 10, backgroundColor: ink }]}>
            <Text style={[styles.tagText, { color: dark ? '#0F111A' : '#FFFFFF' }]}>{formatAxisPrice(ch.close, tickStep)}</Text>
          </View>
        )}
      </View>

      {/* bottom time axis */}
      <View style={[styles.timeRow, { top: priceH + volH, width: plotW }]} pointerEvents="none">
        {labelIdx.map((i) => {
          const c = candles[i];
          if (!c) return null;
          const label = formatAxisTime(c.t, interval);
          const bold = /^\d{1,2}$/.test(label);
          return (
            <Text key={`tl${i}`} style={[styles.timeText, { left: xOf(i) - 20, color: bold ? ink : axisTxt, fontFamily: bold ? 'Inter-700' : 'Inter-500', fontWeight: bold ? '700' : '500' }]}>
              {label}
            </Text>
          );
        })}
      </View>

      {/* crosshair OHLC readout */}
      {ch && (
        <View style={[styles.readout, { backgroundColor: dark ? '#1D2133' : '#FFFFFF', borderColor: grid }]} pointerEvents="none">
          <Text style={[styles.readText, { color: axisTxt }]}>{`O ${formatAxisPrice(ch.open, tickStep)}  H ${formatAxisPrice(ch.high, tickStep)}`}</Text>
          <Text style={[styles.readText, { color: axisTxt }]}>{`L ${formatAxisPrice(ch.low, tickStep)}  C ${formatAxisPrice(ch.close, tickStep)}`}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { position: 'absolute', right: 0, top: 0 },
  axisText: { position: 'absolute', right: 4, fontSize: 11, textAlign: 'right', width: AXIS_W - 4 },
  tag: { position: 'absolute', right: 0, height: 20, minWidth: AXIS_W - 2, borderRadius: 3, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  tagText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter-700', fontWeight: '700' },
  timeRow: { position: 'absolute', left: 0, height: TIME_H },
  timeText: { position: 'absolute', top: 6, width: 40, textAlign: 'center', fontSize: 11 },
  readout: { position: 'absolute', left: 8, top: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  readText: { fontSize: 10, fontFamily: 'Inter-500' },
});
