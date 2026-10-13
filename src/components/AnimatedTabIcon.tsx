/**
 * Veltravia Wallet — animated wrapper for bottom bar icons.
 *
 * Any tab icon wrapped here pulses on tap (immediate pop + settle) and
 * keeps a slow idle pulse, matching the Home/bell/scan animation rhythm.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';

export type TabIconHandle = { pulse: () => void };

const AnimatedTabIcon = forwardRef<TabIconHandle, {
  children: React.ReactNode;
  style?: ViewStyle;
}>(({ children, style }, ref) => {
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
    <Animated.View style={[{ alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
});

export default AnimatedTabIcon;
