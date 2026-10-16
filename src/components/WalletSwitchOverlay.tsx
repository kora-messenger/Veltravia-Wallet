/**
 * Veltravia Wallet — wallet-switch loading page.
 *
 * Mirrors Trust: after the user picks a different wallet, Home shows a
 * blank page with a single purple arc spinner centred on screen (the
 * floating tab bar stays visible underneath), then reveals the new
 * wallet's Home. Covers the whole Home root, header included.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

const SIZE = 32;
const STROKE = 3.5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export default function WalletSwitchOverlay() {
  const { theme } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const dark = theme.mode === 'dark';

  return (
    <View style={[styles.cover, { backgroundColor: theme.background }]} accessibilityLabel="Loading wallet">
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={SIZE} height={SIZE}>
          {/* faint full ring */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={dark ? 'rgba(255,255,255,0.14)' : 'rgba(102,61,251,0.22)'}
            strokeWidth={STROKE}
            fill="none"
          />
          {/* bright quarter arc */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={theme.brand}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${C * 0.28} ${C}`}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Sits above Home content; the floating tab bar is a sibling above Home.
    zIndex: 50,
    elevation: 50,
  },
});
