/**
 * Veltravia Wallet — animated QR scan icon.
 *
 * The scan line sweeps down and up inside the corner frame, pauses,
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

  // line travels between viewBox y=7.5 and y=16.5 (inside the corner marks)
  const minY = 7.5 * scale - strokeWidth / 2;
  const maxY = 16.5 * scale - strokeWidth / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M4 8V6a2 2 0 012-2h2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <Path d="M16 4h2a2 2 0 012 2v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <Path d="M20 16v2a2 2 0 01-2 2h-2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        <Path d="M8 20H6a2 2 0 01-2-2v-2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
      </Svg>
      <Animated.View
        style={{
          position: 'absolute',
          left: 4 * scale,
          right: 4 * scale,
          height: strokeWidth,
          borderRadius: strokeWidth / 2,
          backgroundColor: color,
          transform: [
            {
              translateY: sweep.interpolate({
                inputRange: [0, 1],
                outputRange: [minY, maxY],
              }),
            },
          ],
        }}
      />
    </View>
  );
}
