/**
 * Veltravia Wallet — "Enable notifications" bottom sheet.
 *
 * Pops over the home screen right after the account is created
 * (create path: biometric allowed OR denied — both land here).
 *
 * Locked copy (Ijezie, Oct 10 2026):
 *   description: "Enable notifications to monitor price changes and stay
 *                 updated on your transactions."
 *   buttons: "Enable Notifications" (2s load -> Android permission prompt)
 *            "Skip, I'll do it later" (text link)
 *   X top-right behaves like Skip. The sheet closes itself after the
 *   permission prompt is answered either way.
 *
 * Illustration: Ijezie's gold herald trumpet with red banner
 * (assets/notification-trumpet.png, transparent PNG, same in light/dark).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Animated, Easing, PermissionsAndroid, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon } from './icons';
import PrimaryButton from './PrimaryButton';

export default function NotificationSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const [loading, setLoading] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(
    slide.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }),
  ).current;

  useEffect(() => {
    if (visible) {
      slide.setValue(0);
      Animated.timing(slide, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible, slide]);

  const enable = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setTimeout(async () => {
      try {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
        }
      } catch {
        /* user refused or device quirk — sheet closes either way */
      }
      setLoading(false);
      onClose();
    }, 2000);
  }, [loading, onClose]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.scrim,
        {
          opacity: slide,
        },
      ]}
    >
      <Pressable style={styles.scrimTouch} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.surface },
          { transform: [{ translateY: sheetY }] },
        ]}
      >
        <View style={styles.topRow}>
          <Pressable hitSlop={10} onPress={onClose} style={styles.closeBtn}>
            <CloseIcon size={22} color={theme.inkMuted} />
          </Pressable>
        </View>

        <View style={styles.art}>
          <Image source={require('../assets/notification-trumpet.png')} style={styles.artImg} resizeMode="contain" />
        </View>

        <Text style={[styles.title, { color: theme.ink }]}>Keep up with the market!</Text>
        <Text style={[styles.desc, { color: theme.inkMuted }]}>
          Enable notifications to monitor price changes and stay updated on your transactions.
        </Text>

        <PrimaryButton label="Enable Notifications" onPress={enable} loading={loading} />

        <Pressable onPress={onClose} style={({ pressed }) => [styles.skip, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.skipText, { color: dark ? '#8F89FF' : theme.brand }]}>
            Skip, I'll do it later
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  scrimTouch: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  topRow: { height: 52, justifyContent: 'center', alignItems: 'flex-end', marginTop: 8 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  art: { alignItems: 'center', marginBottom: 10 },
  artImg: { width: 168, height: 128 },
  title: { fontSize: 19, fontFamily: 'Inter-700', textAlign: 'center', marginBottom: 8 },
  desc: { fontSize: 14, lineHeight: 20, textAlign: 'center', fontFamily: 'Inter-400', marginBottom: 24 },
  skip: { height: 48, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 15, fontFamily: 'Inter-600' },
});
