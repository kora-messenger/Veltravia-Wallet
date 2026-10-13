/**
 * Veltravia Wallet — animated Home tab icon.
 *
 * The house pulses on every tap (immediate pop + settle) and also does a
 * slow idle pulse so the pill feels alive, matching the bell/scan rhythm.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { HomeTabIcon } from './icons';

export type AnimatedHomeIconHandle = { pulse: () => void };

const AnimatedHomeIcon = forwardRef<AnimatedHomeIconHandle, {
  size?: number;
  color?: string;
  filled?: boolean;
}>(({ size = 24, color = '#000', filled }, ref) => {
  const scaleV = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const steps = (downMs: number, upMs: number) => [
    Animated.timing(scaleV, {
      toValue: 1,
      duration: downMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
    Animated.timing(scaleV, {
      toValue: 0,
      duration: upMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }),
  ];

  const startLoop = () => {
    loopRef.current?.stop();
    loopRef.current = Animated.loop(
      Animated.sequence([Animated.delay(2600), ...(steps as any)])
    );
    loopRef.current.start();
  };

  // every tap: interrupt whatever is running and pop immediately
  useImperativeHandle(ref, () => ({
    pulse: () => {
      loopRef.current?.stop();
      Animated.sequence(steps(130, 400)).start(({ finished }) => {
        if (finished) startLoop();
      });
    },
  }));

  useEffect(() => {
    startLoop();
    return () => loopRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scale = scaleV.interpolate({
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
});

export default AnimatedHomeIcon;
