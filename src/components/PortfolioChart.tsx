/**
 * Veltravia Wallet — large portfolio value chart (Balance Details).
 *
 * Smooth monotone curve + soft gradient area under the line, with a
 * time axis underneath (5 labels). Values are the TOTAL portfolio in
 * USD, not a single asset's price.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Circle } from 'react-native-svg';
import type { PortfolioPoint } from '../services/portfolio';

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p1.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function axisLabel(t: number, rangeDays: number): string {
  const d = new Date(t);
  if (rangeDays <= 7) {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  if (rangeDays <= 90) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short' });
}

export default function PortfolioChart({
  points,
  rangeDays,
  width,
  height = 190,
  color = '#6C4CF5',
}: {
  points: PortfolioPoint[];
  rangeDays: number;
  width: number;
  height?: number;
  color?: string;
}) {
  const { theme } = useTheme();
  const padY = 10;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rangeV = max - min || 1;

  const pts = points.map((p, i) => ({
    x: (i / (points.length - 1)) * width,
    y: padY + (1 - (p.value - min) / rangeV) * (height - padY * 2),
  }));
  const line = smoothPath(pts);
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const last = pts[pts.length - 1];

  // 5 axis labels
  const labelCount = 5;
  const labels = Array.from({ length: labelCount }, (_, i) => {
    const idx = Math.round((i / (labelCount - 1)) * (points.length - 1));
    return { t: points[idx].t, x: pts[idx].x };
  });

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <SvgGradient id="pfArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.24} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </SvgGradient>
        </Defs>
        <Path d={area} fill="url(#pfArea)" />
        <Path d={line} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last.x} cy={last.y} r={4.5} fill={color} />
        <Circle cx={last.x} cy={last.y} r={8} fill={color} fillOpacity={0.2} />
      </Svg>
      <View style={styles.axis}>
        {labels.map((l, i) => (
          <Text
            key={i}
            style={[styles.axisLabel, { color: theme.inkMuted }, i === 0 && styles.axisLeft, i === labels.length - 1 && styles.axisRight]}
          >
            {axisLabel(l.t, rangeDays)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginHorizontal: -4 },
  axisLabel: { fontSize: 11, fontFamily: 'Inter-500', fontWeight: '500' },
  axisLeft: { textAlign: 'left' },
  axisRight: { textAlign: 'right' },
});
