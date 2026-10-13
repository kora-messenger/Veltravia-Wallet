/**
 * Veltravia Wallet — animated Home tab icon.
 *
 * The house does a soft "settle" pulse: it pops up slightly, overshoots
 * a touch and settles back, rests, then pulses again. Matches the rhythm
 * of the animated bell and scan icons.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { HomeTabIcon } from './icons';

export default function AnimatedHomeIcon({
  size = 24,
  color = '#000',
  filled,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.14],
  });

  return (
    <Animated.View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale }],
      }}
    >
      <HomeTabIcon size={size} color={color} filled={filled} />
    </Animated.View>
  );
}
