/**
 * Veltravia Wallet — "Edit icon" bottom sheet (Trust-style).
 *
 * White sheet over a dimmed page: centered title, circular close button,
 * and a 5 x 4 grid of monochrome glyphs in a light rounded panel. The
 * selected glyph sits in a white rounded tile.
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon } from './icons';
import { WALLET_GLYPHS, GLYPH_ORDER, LogoColorGlyph } from '../wallets/WalletGlyphs';

export default function EditIconSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = theme.mode === 'dark';
  const sheet = dark ? theme.surface : '#FFFFFF';
  const panel = dark ? 'rgba(255,255,255,0.07)' : '#EFEFF3';
  const tile = dark ? 'rgba(255,255,255,0.16)' : '#FFFFFF';
  const closeBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(60,64,90,0.08)';
  const idle = dark ? 'rgba(255,255,255,0.55)' : '#7B7F96';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: sheet, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.ink }]}>Edit icon</Text>
            <Pressable hitSlop={12} onPress={onClose} style={[styles.closeBtn, { backgroundColor: closeBg }]}>
              <CloseIcon size={20} color={theme.ink} />
            </Pressable>
          </View>

          <View style={[styles.panel, { backgroundColor: panel }]}>
            {GLYPH_ORDER.filter((g) => g !== 'veltravia').map((g) => {
              const Glyph = WALLET_GLYPHS[g];
              const on = g === selected;
              return (
                <Pressable key={g} onPress={() => onSelect(g)} style={styles.cell}>
                  <View style={[styles.tile, on && { backgroundColor: tile }]}>
                    <Glyph size={28} color={on ? theme.ink : idle} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,16,0.45)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 22 },
  titleRow: { height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  closeBtn: {
    position: 'absolute',
    right: 0,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 6 },
  cell: { width: '20%', alignItems: 'center', paddingVertical: 8 },
  tile: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
