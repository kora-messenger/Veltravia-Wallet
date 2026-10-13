/**
 * Veltravia Wallet — animated QR scan icon.
 *
 * The scan line sweeps down and up INSIDE the corner frame, pauses,
 * then sweeps again — the motion of a live QR scanner.
 * Corners are the standard ScanIcon outline; only the line moves.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export default function AnimatedScanIcon({
  size = 22,
  color = '#000',
  strokeWidth = 2,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const sweep = useRef(new Animated.Value(0)).current;
  const scale = size / 24; // viewBox 24 -> px

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1300),
        Animated.timing(sweep, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(260),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 550,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  // The bar is anchored with `top` at the START of its travel and only
  // translated by the distance travelled. (Before, the wrapper centred it AND
  // an absolute y was added on top, so it overshot out of the box.)
  // The line is a stroke centred on its y, so it travels viewBox y 8 -> 16,
  // strictly between the top and bottom corner marks (4..8 and 16..20).
  const half = strokeWidth / 2;
  const startTop = 8 * scale - half;
  const travel = 8 * scale;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M4 8V6a2 2 0 012-2h2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <Path d="M16 4h2a2 2 0 012 2v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <Path d="M20 16v2a2 2 0 01-2 2h-2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <Path d="M8 20H6a2 2 0 01-2-2v-2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
      </Svg>
      <Animated.View
        style={{
          position: 'absolute',
          top: startTop,
          left: 6 * scale,
          right: 6 * scale,
          height: strokeWidth,
          borderRadius: half,
          backgroundColor: color,
          transform: [
            {
              translateY: sweep.interpolate({
                inputRange: [0, 1],
                outputRange: [0, travel],
              }),
            },
          ],
        }}
      />
    </View>
  );
}
