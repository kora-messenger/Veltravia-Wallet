/**
 * Veltravia Wallet — animated wrapper for bottom bar icons.
 *
 * Icons sit completely still until tapped; the tapped icon pops and
 * settles. No idle animation on any tab.
 */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';

export type TabIconHandle = { pulse: () => void };

const AnimatedTabIcon = forwardRef<TabIconHandle, {
  children: React.ReactNode;
  style?: ViewStyle;
}>(({ children, style }, ref) => {
  const scaleV = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    pulse: () => {
      // interrupt an in-flight pulse so rapid taps always restart cleanly
      scaleV.stopAnimation(() => {
        Animated.sequence([
          Animated.timing(scaleV, {
            toValue: 1,
            duration: 130,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scaleV, {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
  }));

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
