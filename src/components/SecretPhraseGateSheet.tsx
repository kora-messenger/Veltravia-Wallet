/**
 * Veltravia Wallet — "This secret phrase unlocks your wallet" gate.
 *
 * Bottom sheet shown before revealing a recovery phrase: illustration,
 * "For your eyes only!" note, headline, two acknowledgement checkboxes and a
 * Continue button that stays disabled until both are ticked.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, CheckIcon, InfoCircleIcon, SecretShieldArt } from './icons';

const POINTS = [
  'Veltravia Wallet does not have access to this secret phrase.',
  'I understand that sharing my secret phrase could result in permanent loss of assets.',
];

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
  const dark = theme.mode === 'dark';
  const [checked, setChecked] = useState<boolean[]>([false, false]);

  useEffect(() => {
    if (!visible) setChecked([false, false]);
  }, [visible]);

  const allChecked = checked.every(Boolean);
  const sheet = dark ? theme.surface : '#FFFFFF';
  const card = dark ? 'rgba(255,255,255,0.07)' : '#F0F0F4';
  const closeBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(60,64,90,0.08)';
  const brand = theme.brandGradient[0];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: sheet, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.closeRow}>
            <Pressable hitSlop={12} onPress={onClose} style={[styles.closeBtn, { backgroundColor: closeBg }]}>
              <CloseIcon size={20} color={theme.ink} />
            </Pressable>
          </View>

          <View style={styles.art}>
            <SecretShieldArt size={170} />
          </View>

          <View style={styles.eyes}>
            <InfoCircleIcon size={16} color={theme.inkMuted} />
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
                {checked[i] && <CheckIcon size={16} color="#FFFFFF" />}
              </View>
              <Text style={[styles.pointText, { color: theme.ink }]}>{text}</Text>
            </Pressable>
          ))}

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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,16,0.5)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 16 },
  closeRow: { alignItems: 'flex-end' },
  closeBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  art: { alignItems: 'center', marginTop: 4 },
  eyes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 },
  eyesText: { fontSize: 15, fontWeight: '600' },
  headline: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 33,
    marginTop: 22,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  point: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 18, marginBottom: 10 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, fontSize: 16, fontWeight: '500', lineHeight: 22 },
  cta: { height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  ctaText: { fontSize: 17, fontWeight: '700' },
});
