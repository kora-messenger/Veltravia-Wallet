/**
 * Veltravia Wallet — wallet action popup.
 *
 * Floating white card anchored under the tapped "..." button, right-aligned
 * to it, over a light dim. Rows: Manage, Back up to Google Drive (red badge while the
 * wallet is not backed up).
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { GearIcon, CloudIcon } from './icons';

export interface MenuAnchor {
  /** Bottom edge of the tapped button, in window coordinates. */
  y: number;
  /** Right edge of the tapped button, in window coordinates. */
  right: number;
}

export default function WalletActionMenu({
  visible,
  anchor,
  showBackupBadge,
  onClose,
  onManage,
  onBackup,
}: {
  visible: boolean;
  anchor: MenuAnchor | null;
  showBackupBadge: boolean;
  onClose: () => void;
  onManage: () => void;
  onBackup: () => void;
}) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const dark = theme.mode === 'dark';
  const card = dark ? theme.surfaceAlt : '#FFFFFF';

  if (!anchor) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.dim, { backgroundColor: dark ? 'rgba(0,0,0,0.45)' : 'rgba(30,32,48,0.12)' }]} onPress={onClose}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: card,
              top: anchor.y + 4,
              right: Math.max(width - anchor.right, 12),
            },
          ]}
        >
          <Pressable style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]} onPress={onManage}>
            <GearIcon size={20} color={theme.ink} />
            <Text style={[styles.label, { color: theme.ink }]}>Manage</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]} onPress={onBackup}>
            <View>
              <CloudIcon size={20} color={theme.ink} />
              {showBackupBadge && <View style={[styles.badge, { borderColor: card }]} />}
            </View>
            <Text style={[styles.label, { color: theme.ink }]}>Back up to Google Drive</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1 },
  card: {
    position: 'absolute',
    minWidth: 262,
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  label: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600', letterSpacing: -0.1 },
  badge: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#E53935',
    borderWidth: 1.5,
  },
});
