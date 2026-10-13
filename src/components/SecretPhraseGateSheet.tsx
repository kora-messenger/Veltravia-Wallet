/**
 * Veltravia Wallet — "This secret phrase unlocks your wallet" gate.
 *
 * Mirrors Trust Wallet's sheet: a tall bottom sheet (top sits ~36dp below
 * the status bar), close button top-right, illustration, "For your eyes
 * only!" note, headline, two acknowledgement cards, and a Continue button
 * pinned to the bottom. Drag the sheet down (or tap the backdrop / X) to
 * dismiss. Continue stays disabled until both boxes are ticked.
 *
 * Type is intentionally small (Trust-sized): headline 20/28, body 14/21.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  PanResponder,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, CheckIcon, InfoCircleIcon, SecretShieldArt } from './icons';

const POINTS = [
  'Veltravia Wallet does not have access to this secret phrase.',
  'I understand that sharing my secret phrase could result in permanent loss of assets.',
];

const TOP_GAP = 36; // dp between top of screen and top of sheet (Trust)
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.9;

export default function SecretPhraseGateSheet({
  visible,
  onClose,
  onContinue,
}: {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const dark = theme.mode === 'dark';
  const [checked, setChecked] = useState<boolean[]>([false, false]);

  const sheetH = winH - TOP_GAP;
  const translateY = useRef(new Animated.Value(sheetH)).current;
  const backdrop = translateY.interpolate({
    inputRange: [0, sheetH],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Slide in when shown, reset ticks when hidden.
  useEffect(() => {
    if (visible) {
      translateY.setValue(sheetH);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      setChecked([false, false]);
    }
  }, [visible, sheetH, translateY]);

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: sheetH,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onClose());
  }, [onClose, sheetH, translateY]);

  // Drag down anywhere on the sheet to close (only downward drags).
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          translateY.setValue(Math.max(0, g.dy));
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
            dismiss();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              bounciness: 0,
              speed: 20,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, { toValue: 0, bounciness: 0, speed: 20, useNativeDriver: true }).start();
        },
      }),
    [dismiss, translateY],
  );

  const allChecked = checked.every(Boolean);
  const sheet = dark ? theme.surface : '#FFFFFF';
  const card = dark ? 'rgba(255,255,255,0.07)' : '#F0F0F4';
  const closeBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(60,64,90,0.08)';
  const brand = theme.brandGradient[0];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.flex}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.sheet,
            {
              height: sheetH,
              backgroundColor: sheet,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.closeRow}>
            <Pressable hitSlop={12} onPress={dismiss} style={[styles.closeBtn, { backgroundColor: closeBg }]}>
              <CloseIcon size={18} color={theme.ink} />
            </Pressable>
          </View>

          <View style={styles.art}>
            <SecretShieldArt size={156} />
          </View>

          <View style={styles.eyes}>
            <InfoCircleIcon size={14} color={theme.inkMuted} />
            <Text style={[styles.eyesText, { color: theme.inkMuted }]}>For your eyes only!</Text>
          </View>

          <Text style={[styles.headline, { color: theme.ink }]}>This secret phrase unlocks your wallet</Text>

          {POINTS.map((text, i) => (
            <Pressable
              key={text}
              style={[styles.point, { backgroundColor: card }]}
              onPress={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
            >
              <View
                style={[
                  styles.box,
                  checked[i] ? { backgroundColor: brand, borderColor: brand } : { borderColor: theme.inkMuted },
                ]}
              >
                {checked[i] && <CheckIcon size={14} color="#FFFFFF" />}
              </View>
              <Text style={[styles.pointText, { color: theme.ink }]}>{text}</Text>
            </Pressable>
          ))}

          {/* Continue is pinned to the bottom edge, like Trust */}
          <View style={styles.spacer} />
          <Pressable
            disabled={!allChecked}
            onPress={onContinue}
            style={({ pressed }) => [
              styles.cta,
              allChecked
                ? { backgroundColor: brand, opacity: pressed ? 0.85 : 1 }
                : { backgroundColor: card },
            ]}
          >
            <Text style={[styles.ctaText, { color: allChecked ? '#FFFFFF' : theme.inkMuted }]}>Continue</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,16,0.5)' },
  sheet: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  closeRow: { alignItems: 'flex-end' },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  art: { alignItems: 'center', marginTop: 8 },
  eyes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 },
  eyesText: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
  headline: {
    fontSize: 20,
    fontFamily: 'Inter-700',
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 28,
    marginTop: 14,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500', lineHeight: 21 },
  spacer: { flex: 1 },
  cta: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700' },
});
