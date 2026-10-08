/**
 * Veltravia Wallet — wallet action popup.
 *
 * Floating white card anchored under the tapped "..." button, right-aligned
 * to it, over a light dim. Rows: Manage, Back up wallet (red badge while the
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
              top: anchor.y + 8,
              right: Math.max(width - anchor.right, 12),
            },
          ]}
        >
          <Pressable style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]} onPress={onManage}>
            <GearIcon size={22} color={theme.ink} />
            <Text style={[styles.label, { color: theme.ink }]}>Manage</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]} onPress={onBackup}>
            <View>
              <CloudIcon size={22} color={theme.ink} />
              {showBackupBadge && <View style={[styles.badge, { borderColor: card }]} />}
            </View>
            <Text style={[styles.label, { color: theme.ink }]}>Back up wallet</Text>
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
    minWidth: 300,
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  badge: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E53935',
    borderWidth: 1.5,
  },
});
