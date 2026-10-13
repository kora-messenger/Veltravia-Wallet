/**
 * Veltravia Wallet — portfolio donut.
 *
 * Pure SVG ring split into rounded-gap segments, with the total shown in
 * the middle (children). Segments are { value, color }; values are
 * normalised, so they can be percentages or raw fiat amounts.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Segment {
  value: number;
  color: string;
}

export default function DonutChart({
  segments,
  size = 108,
  thickness = 16,
  trackColor = 'rgba(120,120,160,0.12)',
  children,
}: {
  segments: Segment[];
  size?: number;
  thickness?: number;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const gap = 3; // visual gap between segments, in px of arc
  let offset = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={thickness} fill="none" />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const dash = Math.max(0, len - gap);
          const el = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth={thickness}
              fill="none"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              // start at 12 o'clock
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return el;
        })}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
