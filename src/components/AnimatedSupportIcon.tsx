/**
 * Veltravia Wallet — animated support (headset) icon.
 *
 * Always animating: a gentle continuous tilt-and-bob, like a headset
 * "listening". Runs for as long as the icon is mounted.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { SupportIcon } from './icons';

export default function AnimatedSupportIcon({
  size = 24,
  color = '#000',
}: {
  size?: number;
  color?: string;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: -1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  return (
    <Animated.View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        transform: [
          { rotate: t.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] }) },
          { translateY: t.interpolate({ inputRange: [-1, 0, 1], outputRange: [-1.2, 0, -1.2] }) },
          { scale: t.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.06, 1, 1.06] }) },
        ],
      }}
    >
      <SupportIcon size={size} color={color} />
    </Animated.View>
  );
}
