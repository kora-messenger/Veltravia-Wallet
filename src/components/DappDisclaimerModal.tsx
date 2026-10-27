/**
 * Veltravia Wallet — dApp disclaimer (Trust parity).
 *
 * Centered white card over a dimmed backdrop, shown when the user opens a
 * dApp from Discover. Grey X top-right, book illustration, bold
 * "Disclaimer", the approved body text, an "I accept the Terms of Use"
 * circular checkbox (Terms of Use in Veltravia violet), and two pill
 * buttons: Cancel (lavender, violet text) and Confirm (violet, white text).
 * Confirm is tappable only while the checkbox is ticked.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import AppModal from './AppModal';
import { CloseIcon } from './icons';

export const DISCLAIMER_TEXT =
  'We do not own, operate, or endorse any third-party dApps or websites. ' +
  'Your use of these platforms is entirely at your own risk. ' +
  'We are not responsible for any losses, damages, or issues arising from interactions with ' +
  'third-party services, including disputed transactions. ' +
  'By using Veltravia wallet, you agree to our Terms of Service. ' +
  'Always verify the legitimacy of dApps and conduct your own research before interacting with them.';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DappDisclaimerModal({ visible, onCancel, onConfirm }: Props) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const [accepted, setAccepted] = useState(false);
  if (!visible) return null;

  return (
    <AppModal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={styles.dim} onPress={onCancel}>
        <Pressable style={[styles.card, { backgroundColor: dark ? theme.surfaceAlt : '#FFFFFF' }]} onPress={(e) => e.stopPropagation()}>
          <Pressable hitSlop={12} style={styles.close} onPress={onCancel}>
            <CloseIcon size={16} color={dark ? '#8A8EA3' : '#9A9DA8'} strokeWidth={2.4} />
          </Pressable>

          <Image source={require('../assets/dapp-disclaimer-book.png')} style={styles.art} resizeMode="contain" />

          <Text style={[styles.title, { color: theme.ink }]}>Disclaimer</Text>
          <Text style={[styles.body, { color: theme.ink }]}>{DISCLAIMER_TEXT}</Text>

          <Pressable style={styles.checkRow} onPress={() => setAccepted((v) => !v)} hitSlop={8}>
            <View style={[styles.check, { borderColor: accepted ? theme.brand : '#B9BCC9', backgroundColor: accepted ? theme.brand : 'transparent' }]}>
              {accepted && <View style={styles.checkTick} />}
            </View>
            <Text style={[styles.checkText, { color: theme.ink }]}>
              I accept the{' '}
              <Text style={{ color: theme.brand, fontFamily: 'Inter-600', fontWeight: '600' }}>Terms of Use</Text>
            </Text>
          </Pressable>

          <View style={styles.btnRow}>
            <Pressable
              style={({ pressed }) => [styles.btnCancel, { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#F0F0F7', opacity: pressed ? 0.8 : 1 }]}
              onPress={onCancel}
            >
              <Text style={[styles.btnCancelText, { color: theme.brand }]}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!accepted}
              style={({ pressed }) => [
                styles.btnConfirm,
                { backgroundColor: theme.brand, opacity: !accepted ? 0.45 : pressed ? 0.85 : 1 },
              ]}
              onPress={accepted ? onConfirm : undefined}
            >
              <Text style={styles.btnConfirmText}>Confirm</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', borderRadius: 20, paddingTop: 40, paddingBottom: 22, paddingHorizontal: 22, elevation: 12 },
  close: { position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  art: { width: 116, height: 96, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontFamily: 'Inter-700', fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 14, fontFamily: 'Inter-400', lineHeight: 22, textAlign: 'center', opacity: 0.9, marginBottom: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center', marginBottom: 22 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkTick: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  checkText: { fontSize: 14, fontFamily: 'Inter-400' },
  btnRow: { flexDirection: 'row', gap: 12 },
  btnCancel: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  btnCancelText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  btnConfirm: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  btnConfirmText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
});
