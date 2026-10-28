/**
 * "Order book settings" bottom sheet (Trust recording, Oct 28).
 *
 *   [X]      Order book settings      Reset
 *   Display currency   (USD) (BTC)
 *   ----------------------------------
 *   Group by           (1) (2) (5) (10) (100)
 *   [            Apply            ]
 *
 * Selected chip = darker grey (same palette as the Filter sheet). Nothing
 * changes on the book until Apply; Reset puts the draft back to USD / 1.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppModal from './AppModal';
import { CloseIcon } from './icons';
import { useTheme } from '../theme/ThemeProvider';
import { FONT } from '../theme/typography';
import {
  type BookSettings, type BookCurrency, type BookGroup, DEFAULT_BOOK_SETTINGS, isDefaultBookSettings,
} from '../services/orderBook';

const BTN = '#392EFA';

interface Props {
  visible: boolean;
  settings: BookSettings;
  baseSymbol: string;
  groups: BookGroup[];
  onClose: () => void;
  onApply: (s: BookSettings) => void;
}

export default function OrderBookSettingsSheet({ visible, settings, baseSymbol, groups, onClose, onApply }: Props) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<BookSettings>(settings);
  useEffect(() => { if (visible) setDraft(settings); }, [visible, settings]);

  const chipIdle = dark ? '#232640' : '#EFEEF1';
  const chipSel = dark ? '#3A3E5C' : '#CECED6';
  const txtIdle = dark ? '#9A9EB5' : '#818685';
  const txtSel = dark ? '#FFFFFF' : '#080D13';
  const dirty = !isDefaultBookSettings(draft);

  const Chip = ({ label, selected, onPress, a11y }: { label: string; selected: boolean; onPress: () => void; a11y: string }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? chipSel : chipIdle }]}
    >
      <Text style={[styles.chipText, { color: selected ? txtSel : txtIdle }]}>{label}</Text>
    </Pressable>
  );

  return (
    <AppModal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.scrim, { backgroundColor: dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.21)' }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: dark ? theme.surface : '#FFFFFF', paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[styles.handle, { backgroundColor: dark ? '#3A3E5C' : '#E4E4E9' }]} />
        <View style={styles.header}>
          <Pressable accessibilityLabel="Close order book settings" onPress={onClose} style={[styles.circle, { backgroundColor: dark ? '#232640' : '#F0F0F2' }]}>
            <CloseIcon size={18} color={theme.ink} />
          </Pressable>
          <View style={styles.titleWrap} pointerEvents="none">
            <Text style={[styles.title, { color: theme.ink }]}>Order book settings</Text>
          </View>
          <Pressable accessibilityLabel="Reset order book settings" hitSlop={12} disabled={!dirty} onPress={() => setDraft(DEFAULT_BOOK_SETTINGS)} style={[styles.resetPill, { backgroundColor: chipIdle }]}>
            <Text style={[styles.reset, { color: dirty ? theme.ink : dark ? '#5B5F78' : '#B9B9C0' }]}>Reset</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { color: theme.ink }]}>Display currency</Text>
        <View style={styles.chipRow}>
          {(['USD', baseSymbol] as const).map((c, i) => {
            const cur: BookCurrency = i === 0 ? 'USD' : 'BTC';
            return <Chip key={c} label={c} a11y={`Currency ${c}`} selected={draft.currency === cur} onPress={() => setDraft((d) => ({ ...d, currency: cur }))} />;
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: dark ? '#252A3D' : '#EAEAEE' }]} />

        <Text style={[styles.label, { color: theme.ink }]}>Group by</Text>
        <View style={styles.chipRow}>
          {groups.map((g) => (
            <Chip key={g} label={String(g)} a11y={`Group ${g}`} selected={draft.group === g} onPress={() => setDraft((d) => ({ ...d, group: g }))} />
          ))}
        </View>

        <Pressable
          accessibilityLabel="Apply"
          onPress={() => { onApply(draft); onClose(); }}
          style={({ pressed }) => [styles.apply, { backgroundColor: BTN, opacity: pressed ? 0.9 : 1 }]}
        >
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 10 },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  circle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { position: 'absolute', left: 0, right: 0, height: 52, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT.semiBold, fontSize: 18, lineHeight: 24 },
  resetPill: { height: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reset: { fontFamily: FONT.semiBold, fontSize: 16 },
  label: { fontFamily: FONT.semiBold, fontSize: 20, lineHeight: 26, marginBottom: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  chip: { minWidth: 56, height: 46, borderRadius: 23, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FONT.semiBold, fontSize: 17 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 22 },
  apply: { height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  applyText: { color: '#FFFFFF', fontFamily: FONT.semiBold, fontSize: 18 },
});
