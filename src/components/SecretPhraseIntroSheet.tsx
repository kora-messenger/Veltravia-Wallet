/**
 * Veltravia Wallet — "Keep your secret phrase safe" (the Show gate).
 *
 * In the current Trust build this is the ONLY thing between tapping "Show" on the
 * Secret phrase screen and the words appearing: a close button, an illustration,
 * a headline, two short warnings and one "I understand". Nobody reads the phrase
 * before it, and the screen behind it stays concealed.
 *
 * The illustration is the existing brand asset; swap the file, not this layout,
 * when the final art lands.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppModal from './AppModal';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon } from './icons';

const POINTS = [
  'Write your secret phrase down, do not store it unencrypted, do not screenshot it or take a photo.',
  'Anyone who has your secret phrase will have a full control over your wallet and your funds.',
];

export default function SecretPhraseIntroSheet({
  visible,
  onClose,
  onUnderstand,
}: {
  visible: boolean;
  onClose: () => void;
  onUnderstand: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  if (!visible) return null;

  return (
    // A short, centred dialog rather than a full sheet: Trust dims the screen and
    // floats the card over it, so the user can see it is a checkpoint, not a page.
    <AppModal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surfaceAlt,
              borderColor: theme.border,
              maxHeight: Math.min(height * 0.8, 560),
              marginBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View style={styles.closeRow}>
            <Pressable hitSlop={12} onPress={onClose} style={styles.closeBtn} testID="phraseIntroClose">
              <CloseIcon size={18} color={theme.inkMuted} />
            </Pressable>
          </View>

          <View style={styles.art}>
            <Image source={require('../assets/secret-shield.png')} style={styles.artImg} resizeMode="contain" />
          </View>

          <Text style={[styles.headline, { color: theme.ink }]}>Keep your secret phrase safe</Text>

          {POINTS.map((text) => (
            <Text key={text} style={[styles.pointText, { color: theme.inkMuted }]}>
              {text}
            </Text>
          ))}

          <Pressable
            onPress={onUnderstand}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: theme.brand, opacity: pressed ? 0.9 : 1 },
            ]}
            testID="phraseIntroUnderstand"
          >
            <Text style={styles.ctaText}>I understand</Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,7,14,0.72)', justifyContent: 'flex-end', paddingHorizontal: 16 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingBottom: 20 },
  closeRow: { alignItems: 'flex-end', paddingTop: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  art: { alignItems: 'center', paddingTop: 2, paddingBottom: 10 },
  artImg: { width: 132, height: 132 },
  headline: { fontSize: 19, fontFamily: 'Inter-700', fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  pointText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter-400',
    textAlign: 'center',
    marginTop: 12,
  },
  cta: {
    marginTop: 20,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
});
