/**
 * Veltravia Wallet — biometric splash.
 *
 * The full-screen purple→blue gradient shown behind the OS fingerprint /
 * face prompt (Trust opens its biometric screen the same way): back arrow
 * top-left, the Veltravia shield-and-wallet app icon dead-center. Measured from Ijezie's reference
 * screenshot (461x1024): V ≈ 15% of screen width, centered ≈ 51% down,
 * back arrow ≈ 9% from the left at ≈ 11.5% down.
 *
 * Tapping the back arrow cancels and returns to the passcode keypad.
 */
import React from 'react';
import { View, Image, Pressable, StyleSheet, StatusBar, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { BackIcon } from './icons';

export default function BiometricSplash({ onBack }: { onBack?: () => void }) {
  const { width, height } = useWindowDimensions();
  const markSize = Math.round(width * 0.30);
  return (
    <View style={StyleSheet.absoluteFill}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 0.35, y: 1 }}
        colors={['#6C63FF', '#4A90D9']}
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        onPress={onBack}
        hitSlop={14}
        style={{ position: 'absolute', top: height * 0.1, left: width * 0.07, width: 36, height: 36, justifyContent: 'center' }}
      >
        <BackIcon size={24} color="#111" />
      </Pressable>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
        <View style={{ marginTop: height * 0.02 }}>
          <Image source={require('../assets/veltravia-shield.png')} style={{ width: markSize, height: markSize }} resizeMode="contain" />
        </View>
      </View>
    </View>
  );
}
