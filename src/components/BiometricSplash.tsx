/**
 * Veltravia Wallet — biometric splash.
 *
 * The full-window surface shown behind the OS fingerprint / face prompt.
 * It mirrors the NATIVE launch splash exactly (Trust parity: the launch
 * splash holds ~2s, then crossfades into this with zero visual change):
 *
 *  - background: same splashBackground color (white / #02070E)
 *  - icon: the same drawable the system splash uses (the 288dp canvas),
 *    rendered at its true system size (288dp, no scaling) and centered in
 *    the full window — the system splash view is a 288dp box with
 *    layout_gravity="center" and fitsSystemWindows=false
 *
 * Must be rendered OUTSIDE SafeAreaView so the icon centers in the true
 * window, not the inset area.
 */
import React from 'react';
import { StyleSheet, Image, StatusBar, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export default function BiometricSplash() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  // Must equal android/.../values/colors.xml splashBackground (+ values-night).
  const splashColor = dark ? '#02070E' : '#FFFFFF';
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: splashColor }]} pointerEvents="none">
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
        <Image
          source={require('../assets/splash-icon-canvas.png')}
          style={{ width: 288, height: 288 }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}
