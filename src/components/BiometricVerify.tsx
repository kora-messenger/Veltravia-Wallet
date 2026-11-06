/**
 * Veltravia Wallet — the biometric verification screen (Trust-parity, Ijezie
 * 6 Nov 2026: "create our own fingerprint interface the way Trust built
 * theirs… connected to the device biometric").
 *
 * This is OURS: the layout, the art, the copy and the failure states are drawn
 * by the app. The scan itself is not, and cannot be. Android gives an app no
 * way to read the fingerprint sensor or draw the sensor UI: the device's own
 * biometric dialog authenticates against the secure hardware and the app only
 * receives a yes/no. So our screen appears the instant the fingerprint key is
 * tapped, the OS dialog rises over it bound to the real sensor, and this screen
 * carries the result: still trying, not recognised, or done.
 *
 * That is exactly how Trust does it — their branded biometric screen first, the
 * system dialog on top of it.
 *
 * Same background colour as the native launch splash (white / #02070E) so
 * cold-start -> biometric has no colour change.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { FingerprintIcon, ScanFaceIcon } from './icons';
import type { BiometryType } from '../core/security/biometrics';

export type BiometricVerifyState = 'checking' | 'failed';

export interface BiometricVerifyProps {
  /** 'checking' while the OS dialog is up, 'failed' once it came back empty. */
  state: BiometricVerifyState;
  /** Which art to draw: face sensors get the face mark, everything else a fingerprint. */
  biometry?: BiometryType;
  /** What the user is proving. 'Unlock your wallet' by default. */
  subtitle?: string;
  /** Why the last attempt did not pass. */
  reason?: string | null;
  /** Backs out of biometrics and returns to the passcode keypad. */
  onUsePasscode: () => void;
  /** Present only when a retry makes sense (not for e.g. a lockout). */
  onRetry?: () => void;
}

const RED = '#E5484D';

export default function BiometricVerify({
  state,
  biometry = 'none',
  subtitle = 'Unlock your wallet with your fingerprint',
  reason,
  onUsePasscode,
  onRetry,
}: BiometricVerifyProps) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const splashColor = dark ? '#02070E' : '#FFFFFF';
  const face = biometry === 'faceId';
  const failed = state === 'failed';

  // A slow halo pulse while the sensor is waiting: it reads as "listening",
  // and stops dead the moment the attempt fails so the state is unmistakable.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (failed) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [failed, pulse]);

  const haloStyle = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
  };

  const body = failed
    ? reason || (face ? 'Face not recognised. Try again.' : 'Fingerprint not recognised. Try again.')
    : face
      ? 'Look at your phone to confirm it is you.'
      : 'Touch the sensor to confirm it is you.';

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: splashColor }]}>
      <View style={styles.center}>
        <View style={styles.markWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.halo, { borderColor: failed ? RED : theme.brand }, haloStyle]}
          />
          {face ? (
            <ScanFaceIcon size={76} color={failed ? RED : theme.brand} />
          ) : (
            <FingerprintIcon size={84} color={failed ? RED : theme.brand} />
          )}
        </View>

        <Text style={[styles.title, { color: theme.ink }]}>Verify it’s you</Text>
        <Text style={[styles.subtitle, { color: theme.inkMuted }]}>{subtitle}</Text>
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.state, { color: failed ? RED : theme.inkMuted }]}
        >
          {body}
        </Text>

        {failed && onRetry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try biometrics again"
            hitSlop={10}
            onPress={onRetry}
            style={({ pressed }) => [styles.primary, { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.primaryText}>{face ? 'Try Face again' : 'Try fingerprint again'}</Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use passcode instead"
          hitSlop={10}
          onPress={onUsePasscode}
          style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.secondaryText, { color: failed ? theme.ink : theme.brand }]}>
            Use passcode instead
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', paddingHorizontal: 32, paddingBottom: 24 },
  // Room for the halo to grow past the glyph without clipping.
  markWrap: { width: 172, height: 172, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  halo: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 2 },
  title: { fontFamily: 'Inter-600', fontSize: 22, lineHeight: 30, textAlign: 'center' },
  subtitle: { fontFamily: 'Inter-500', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  state: { fontFamily: 'Inter-500', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 18, maxWidth: 300 },
  primary: {
    marginTop: 22,
    minWidth: 220,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryText: { fontFamily: 'Inter-600', fontSize: 15, color: '#FFFFFF' },
  secondary: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 16 },
  secondaryText: { fontFamily: 'Inter-600', fontSize: 15 },
});
