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
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
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
  const dark = theme.mode === 'dark';
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onDeny}>
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
            <Pressable
              onPress={onDeny}
              style={({ pressed }) => [
                styles.deny,
                {
                  backgroundColor: dark ? 'rgba(108,99,255,0.22)' : 'rgba(108,99,255,0.12)',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.denyText, { color: theme.ink }]}>Deny</Text>
            </Pressable>

            <Pressable onPress={onConfirm} disabled={false} style={styles.confirm}>
              <LinearGradient
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                colors={theme.buttonGradient as unknown as [string, string]}
                style={styles.confirmGradient}
              >
                <Text style={styles.confirmText}>Confirm</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  deny: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  denyText: { fontSize: 15, fontFamily: 'Inter-600' },
  confirm: { flex: 1, height: 48, borderRadius: 14, overflow: 'hidden' },
  confirmGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-600' },
});
