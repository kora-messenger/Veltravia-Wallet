/**
 * Veltravia Wallet — Add Wallet bottom sheet.
 *
 * Structure follows the reference wallet switcher:
 *   rounded-top sheet over a dimmed Wallets screen,
 *   centered "Add wallet" title with a grey close circle on the same row,
 *   borderless illustration,
 *   two list rows, each a round icon + bold title + muted subtitle
 *   (no filled buttons).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, PlusIcon, ImportIcon } from './icons';

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
  const dark = theme.mode === 'dark';
  const sheet = dark ? theme.surface : '#FFFFFF';
  const closeBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(60,64,90,0.08)';
  const importBg = dark ? 'rgba(108,99,255,0.16)' : '#EFEDFF';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: sheet, paddingBottom: insets.bottom + 20 }]}>
          {/* Title row: centered title, close on the right */}
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.ink }]}>Add wallet</Text>
            <Pressable hitSlop={12} onPress={onClose} style={[styles.closeBtn, { backgroundColor: closeBg }]}>
              <CloseIcon size={20} color={theme.ink} />
            </Pressable>
          </View>

          <Image
            source={require('../assets/add-wallet-illustration.png')}
            style={styles.art}
            resizeMode="contain"
          />

          {/* Option rows */}
          <Pressable
            style={({ pressed }) => [styles.option, { opacity: pressed ? 0.6 : 1 }]}
            onPress={onCreate}
          >
            <View style={[styles.optionIcon, { backgroundColor: theme.brandGradient[0] }]}>
              <PlusIcon size={24} color="#FFFFFF" />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: theme.ink }]}>Create new wallet</Text>
              <Text style={[styles.optionSub, { color: theme.inkMuted }]}>New secret phrase</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.option, { opacity: pressed ? 0.6 : 1 }]}
            onPress={onImport}
          >
            <View style={[styles.optionIcon, { backgroundColor: importBg }]}>
              <ImportIcon size={22} color={theme.brandGradient[0]} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: theme.ink }]}>Add existing wallet</Text>
              <Text style={[styles.optionSub, { color: theme.inkMuted }]} numberOfLines={1}>
                Restore secret phrase or private key
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,16,0.5)' },

  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  title: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600', letterSpacing: -0.2 },
  closeBtn: {
    position: 'absolute',
    right: -4,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  art: {
    alignSelf: 'center',
    width: 210,
    height: 210,
    marginTop: 10,
    marginBottom: 14,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 3 },
  optionTitle: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600', letterSpacing: -0.2 },
  optionSub: { fontSize: 13, fontFamily: 'Inter-400' },
});
