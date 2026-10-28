/**
 * Veltravia Wallet — skeleton loading primitives.
 *
 * Built exactly how Trust Wallet builds its Activity loading state
 * (decoded from the trust.hasm bytecode, 2026-10-09):
 *
 *  - `Skeleton` primitive: an Animated.View filled with the theme's
 *    tertiary background, looping opacity 1 -> 0.6 (700ms, linear) ->
 *    1 (600ms, linear), useNativeDriver.
 *  - On top of the pulse, a light band sweeps across every block (shimmer):
 *    measured from a Trust screen recording, the highlight passes roughly
 *    every 0.8s. The sweep uses one shared phase so every block moves in
 *    step, exactly like the recording's wave.
 *  - The Activity screen's placeholder data is a constant
 *    SKELETON_ROWS list: [section, 2 rows, section, 6 rows].
 *  - Each row is a "basic" ListItemSkeleton: leading circle, title bar
 *    at 60% width / 16dp, description bar under it, right-aligned
 *    value bar (60dp) + label bar.
 *  - Section title bar: 64 x 16, radius 4, 24dp above the section,
 *    12dp padding between rows.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { SP, RADIUS } from '../theme/typography';

/** One shared pulse for every skeleton block (Trust shares one Animated.Value per Skeleton). */
const sharedPulse = new Animated.Value(1);
/** Shared shimmer phase: 0 -> 1 = one highlight pass across a block. */
const sharedSweep = new Animated.Value(0);

let pulseStarted = false;
function startPulse() {
  if (pulseStarted) return;
  pulseStarted = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(sharedPulse, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      Animated.timing(sharedPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]),
  ).start();
  // Shimmer sweep, ~0.8s per pass (measured from Trust's screen recording).
  Animated.loop(
    Animated.timing(sharedSweep, { toValue: 1, duration: 800, useNativeDriver: true }),
  ).start();
}

export function SkeletonBlock({ style }: { style?: any }) {
  const { theme } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const gid = useRef(`sk${Math.floor(Math.random() * 1e9).toString(36)}`).current;
  useEffect(() => {
    startPulse();
  }, []);
  // Veltravia tertiary: the themed surfaceAlt token (lavender / navy).
  const fill = theme.surfaceAlt;
  const dark = theme.mode === 'dark';
  const translateX = sharedSweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-size.w, size.w],
  });
  return (
    <Animated.View
      style={[{ backgroundColor: fill, opacity: sharedPulse, overflow: 'hidden' }, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
      }}
    >
      {size.w > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, width: size.w, height: size.h, transform: [{ translateX }] }}
        >
          <Svg width={size.w} height={size.h}>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={dark ? 0.07 : 0.45} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${gid})`} />
          </Svg>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** Trust "basic" ListItemSkeleton: avatar circle + title/description bars + right value/label bars. */
function SkeletonRow() {
  const { theme } = useTheme();
  return (
    <View style={rowStyles.row}>
      <SkeletonBlock style={rowStyles.avatar} />
      <View style={rowStyles.text}>
        <SkeletonBlock style={rowStyles.title} />
        <SkeletonBlock style={rowStyles.desc} />
      </View>
      <View style={rowStyles.values}>
        <SkeletonBlock style={rowStyles.value} />
        <SkeletonBlock style={rowStyles.label} />
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
    height: 64,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  text: { flex: 1, gap: SP.xs },
  title: { width: '60%', height: 16, borderRadius: RADIUS.xs },
  desc: { width: '40%', height: 12, borderRadius: RADIUS.xs },
  values: { alignItems: 'flex-end', gap: SP.xs },
  value: { width: 60, height: 16, borderRadius: RADIUS.xs },
  label: { width: 40, height: 12, borderRadius: RADIUS.xs },
});

/** Section header placeholder: 64 x 16, radius 4 (Trust skeletonSectionTitle). */
function SkeletonSection() {
  return <SkeletonBlock style={sectionStyles.bar} />;
}
const sectionStyles = StyleSheet.create({
  bar: { width: 64, height: 16, borderRadius: RADIUS.xs },
});

/**
 * Trust's Activity placeholder list (SKELETON_ROWS):
 * section + 2 rows, section + 6 rows.
 */
export function ActivitySkeleton() {
  return (
    <View style={listStyles.list}>
      <SkeletonSection />
      <SkeletonRow />
      <SkeletonRow />
      <View style={{ height: SP.lg }} />
      <SkeletonSection />
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const listStyles = StyleSheet.create({
  list: {
    paddingHorizontal: SP.mdsm,
    gap: SP.mdsm,
    paddingTop: SP.sm,
  },
});
