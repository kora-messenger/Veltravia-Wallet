/**
 * Veltravia Wallet — biometric splash.
 *
 * The full-screen splash-colored surface shown behind the OS fingerprint /
 * face prompt (Trust opens its biometric screen the same way). It uses the
 * SAME color as the native launch splash (white in light mode, #02070E in
 * dark) so cold start -> biometric screen has no color change: back arrow
 * top-left, the Veltravia shield-and-wallet app icon dead-center. Measured from Ijezie's reference
 * screenshot (461x1024): V ≈ 15% of screen width, centered ≈ 51% down,
 * back arrow ≈ 9% from the left at ≈ 11.5% down.
 *
 * Tapping the back arrow cancels and returns to the passcode keypad.
 */
import React from 'react';
import { View, Image, Pressable, StyleSheet, StatusBar, useWindowDimensions } from 'react-native';
import { BackIcon } from './icons';
import { useTheme } from '../theme/ThemeProvider';

export default function BiometricSplash({ onBack }: { onBack?: () => void }) {
  const { width, height } = useWindowDimensions();
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  // Must equal android/.../values/colors.xml splashBackground (+ values-night).
  const splashColor = dark ? '#02070E' : '#FFFFFF';
  const markSize = Math.round(width * 0.30);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: splashColor }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <Pressable
        onPress={onBack}
        hitSlop={14}
        style={{ position: 'absolute', top: height * 0.1, left: width * 0.07, width: 36, height: 36, justifyContent: 'center' }}
      >
        <BackIcon size={24} color={dark ? '#FFFFFF' : '#111111'} />
      </Pressable>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
        <View style={{ marginTop: height * 0.02 }}>
          <Image source={require('../assets/veltravia-shield.png')} style={{ width: markSize, height: markSize }} resizeMode="contain" />
        </View>
      </View>
    </View>
  );
}
