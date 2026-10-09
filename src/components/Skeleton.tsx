/**
 * Veltravia Wallet — skeleton loading primitives.
 *
 * Built exactly how Trust Wallet builds its Activity loading state
 * (decoded from the trust.hasm bytecode, 2026-10-09):
 *
 *  - `Skeleton` primitive: an Animated.View filled with the theme's
 *    tertiary background, looping opacity 1 -> 0.6 (700ms, linear) ->
 *    1 (600ms, linear), useNativeDriver.
 *  - The Activity screen's placeholder data is a constant
 *    SKELETON_ROWS list: [section, 2 rows, section, 6 rows].
 *  - Each row is a "basic" ListItemSkeleton: leading circle, title bar
 *    at 60% width / 16dp, description bar under it, right-aligned
 *    value bar (60dp) + label bar.
 *  - Section title bar: 64 x 16, radius 4, 24dp above the section,
 *    12dp padding between rows.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { SP, RADIUS } from '../theme/typography';

/** One shared pulse for every skeleton block (Trust shares one Animated.Value per Skeleton). */
const sharedPulse = new Animated.Value(1);

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
}

export function SkeletonBlock({ style }: { style?: any }) {
  const { theme } = useTheme();
  useEffect(() => {
    startPulse();
  }, []);
  // Veltravia tertiary: the themed surfaceAlt token (lavender / navy).
  const fill = theme.surfaceAlt;
  return (
    <Animated.View
      style={[{ backgroundColor: fill, opacity: sharedPulse }, style]}
    />
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
