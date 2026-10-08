/**
 * Veltravia Wallet — Add Wallet bottom sheet (Trust-style).
 *
 * Dimmed backdrop (tap to dismiss), white/dark rounded sheet, X button,
 * Veltravia illustration, then two options:
 *   Create new wallet  — "New secret phrase"
 *   Add existing wallet — "Restore secret phrase"
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export default function AddWalletSheet({
  visible,
  onClose,
  onCreate,
  onImport,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: () => void;
  onImport: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const sheet = theme.mode === 'dark' ? theme.surface : '#FFFFFF';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {/* Tap anywhere on the dim to close */}
        <Pressable style={[styles.backdrop, { backgroundColor: 'rgba(2,6,16,0.55)' }]} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: sheet, paddingBottom: insets.bottom + 18 }]}>
          {/* X — top right, over the sheet */}
          <View style={styles.xRow}>
            <Pressable hitSlop={12} onPress={onClose} style={styles.xBtn}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.ink }}>✕</Text>
            </Pressable>
          </View>

          {/* Illustration on a rounded card so it reads on light + dark */}
          <View style={styles.artCard}>
            <Image
              source={require('../assets/add-wallet-illustration.png')}
              style={styles.art}
              resizeMode="contain"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.option, { backgroundColor: theme.brandGradient[0], opacity: pressed ? 0.85 : 1 }]}
            onPress={onCreate}
          >
            <Text style={styles.optionTitle}>Create new wallet</Text>
            <Text style={styles.optionSub}>New secret phrase</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: theme.mode === 'dark' ? theme.surfaceAlt : '#F3F4FA', opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={onImport}
          >
            <Text style={[styles.optionTitle, { color: theme.ink }]}>Add existing wallet</Text>
            <Text style={[styles.optionSub, { color: theme.inkMuted }]}>Restore secret phrase</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
  },
  xRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 12 },
  xBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(140,146,170,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artCard: {
    alignSelf: 'center',
    width: 190,
    height: 190,
    borderRadius: 24,
    marginTop: 6,
    marginBottom: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  art: { width: '100%', height: '100%' },

  option: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  optionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  optionSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
});
