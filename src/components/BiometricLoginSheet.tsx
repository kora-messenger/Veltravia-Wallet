/**
 * Veltravia Wallet — "Biometric Login" popup.
 *
 * Mirrors Trust's dialog exactly in structure but with our wording and art:
 * rounded white card, illustration top, title, description, then two
 * buttons: Deny (soft tinted) and Confirm (solid brand).
 *
 * Ijezie's description (locked): "Use biometric authentication for fast and
 * secure account access."
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppModal from './AppModal';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import { useTheme } from '../theme/ThemeProvider';
import { FingerprintArt } from './icons';


export default function BiometricLoginSheet({
  visible,
  onDeny,
  onConfirm,
}: {
  visible: boolean;
  onDeny: () => void;
  onConfirm: () => void;
}) {
  const { theme } = useTheme();
  if (!visible) return null;

  return (
    <AppModal transparent animationType="fade" statusBarTranslucent onRequestClose={onDeny}>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.art}>
            <FingerprintArt size={104} />
          </View>

          <Text style={[styles.title, { color: theme.ink }]}>Biometric Login</Text>
          <Text style={[styles.desc, { color: theme.inkMuted }]}>
            Use biometric authentication for fast and secure account access.
          </Text>

          <View style={styles.row}>
            <View style={styles.deny}>
              <SecondaryButton label="Deny" onPress={onDeny} height={44} />
            </View>

            <View style={styles.confirm}>
              <PrimaryButton label="Confirm" onPress={onConfirm} height={44} arrow={false} />
            </View>
          </View>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 320,
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  art: { marginBottom: 14 },
  title: { fontSize: 17, fontFamily: 'Inter-700', marginBottom: 8 },
  desc: { fontSize: 13.5, lineHeight: 19, textAlign: 'center', fontFamily: 'Inter-400', marginBottom: 22 },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  deny: { flex: 1 },
  denyText: { fontSize: 15, fontFamily: 'Inter-600' },
  confirm: { flex: 1 },
  confirmGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-600' },
});
