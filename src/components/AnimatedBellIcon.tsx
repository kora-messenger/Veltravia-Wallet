/**
 * Veltravia Wallet — animated notification bell.
 *
 * The Home header bell swings/rings continuously: damped left-right rock
 * around the top lug (the crown), like the live bells in Trust-style apps.
 * The icon itself is the standard BellIcon; only the motion is added.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { BellIcon } from './icons';

export default function AnimatedBellIcon({
  size = 22,
  color = '#000',
}: {
  size?: number;
  color?: string;
}) {
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // rock: 0 -> +14 -> -14 -> 0, pause, repeat. Ease in-out so it reads as a swing.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(swing, {
          toValue: 14,
          duration: 160,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(swing, {
          toValue: -14,
          duration: 320,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(swing, {
          toValue: 11,
          duration: 280,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(swing, {
          toValue: -8,
          duration: 260,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(swing, {
          toValue: 0,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [swing]);

  return (
    <Animated.View
      style={{
        transformOrigin: '50% 12%', // pivot at the bell's crown
        transform: [{ rotate: swing.interpolate({ inputRange: [-20, 20], outputRange: ['-20deg', '20deg'] }) }],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <BellIcon size={size} color={color} />
    </Animated.View>
  );
}
