/**
 * Veltravia Wallet — Perps Activity "Filter" bottom sheet (Trust 10:38 screenshot).
 *
 * The Perps Activity screen's filter-lines button opens THIS sheet (the
 * wallet Activity keeps its own FilterSheet). Layout mirrors the capture:
 *
 *   sheet            bottom sheet over a ~20% dim scrim, 32dp top corners,
 *                    white in light / themed surface in dark, content-sized
 *                    up to 80% of the screen (same envelope as Trust's)
 *   header           42dp close circle (X) + centred bold "Filter" +
 *                    muted "Reset" (grey/inactive until the draft is dirty)
 *   Provider         single-select chips with the venue marks
 *                    (Hyperliquid / Aster)
 *   Assets           row with muted "Select >" (picker arrives with live
 *                    trading data)
 *   Type             multi-select chips: Order (doc), Trade (card),
 *                    Transfer (swap arrows)
 *   Show funding payment  label + 34x22 toggle (default off)
 *   Status           multi-select chips: Completed / Submitted /
 *                    Processing / Failed
 *   Date             single-select chips: 7d / 30d / 90d / Custom
 *   footer           full-width "Show results" pill — pale + muted while the
 *                    draft equals the defaults, brand gradient once dirty —
 *                    plus the drag handle pill at the very bottom
 *
 * Chips: light #f5f5f5 (themed surfaceAlt), ~16dp radius; selected chips get
 * the Veltravia violet tint + brand text.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import AppModal from './AppModal';
import PrimaryButton from './PrimaryButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, ChevronRight, DocIcon, CardIcon, SwapIcon } from './icons';
import { HyperliquidTile, AsterTile } from './PerpsVenueMarks';
import { T, SP, RADIUS, FONT } from '../theme/typography';
import { Animated, Easing } from 'react-native';
import { useRef } from 'react';

export type PerpsProvider = 'hyperliquid' | 'aster';
export type PerpsActivityType = 'order' | 'trade' | 'transfer';
export type PerpsActivityStatus = 'completed' | 'submitted' | 'processing' | 'failed';
export type PerpsActivityDate = '7d' | '30d' | '90d' | 'custom';

export interface PerpsActivityFilters {
  /** null = all providers. */
  provider: PerpsProvider | null;
  /** empty = all assets (picker arrives with live trading data). */
  assets: string[];
  /** empty = all types. */
  type: PerpsActivityType[];
  showFundingPayment: boolean;
  /** empty = all statuses. */
  status: PerpsActivityStatus[];
  /** null = all time. */
  date: PerpsActivityDate | null;
}

export const DEFAULT_PERPS_ACTIVITY_FILTERS: PerpsActivityFilters = {
  provider: null,
  assets: [],
  type: [],
  showFundingPayment: false,
  status: [],
  date: null,
};

function filtersEqual(a: PerpsActivityFilters, b: PerpsActivityFilters): boolean {
  return (
    a.provider === b.provider &&
    a.type.length === b.type.length &&
    a.type.every((t) => b.type.includes(t)) &&
    a.showFundingPayment === b.showFundingPayment &&
    a.status.length === b.status.length &&
    a.status.every((s) => b.status.includes(s)) &&
    a.date === b.date
  );
}

/** Trust-sized toggle: 34x22 track, 18 knob (same part as the wallet sheet). */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [value, anim]);
  const knobX = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 14] });
  return (
    <Pressable hitSlop={10} onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ selected: value }}>
      <View style={[pfs.track, { backgroundColor: value ? theme.brand : theme.mode === 'dark' ? '#2A2D55' : '#D9DBEA' }]}>
        <Animated.View style={[pfs.knob, { transform: [{ translateX: knobX }] }]} />
      </View>
    </Pressable>
  );
}

interface ChipSpec {
  key: string;
  label: string;
  Mark?: React.ComponentType<{ size?: number }>;
}

const PROVIDER_CHIPS: ChipSpec[] = [
  { key: 'hyperliquid', label: 'Hyperliquid', Mark: HyperliquidTile },
  { key: 'aster', label: 'Aster', Mark: AsterTile },
];
const TYPE_CHIPS: ChipSpec[] = [
  { key: 'order', label: 'Order', Mark: DocIcon },
  { key: 'trade', label: 'Trade', Mark: CardIcon },
  { key: 'transfer', label: 'Transfer', Mark: SwapIcon },
];
const STATUS_CHIPS: ChipSpec[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'processing', label: 'Processing' },
  { key: 'failed', label: 'Failed' },
];
const DATE_CHIPS: ChipSpec[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'custom', label: 'Custom' },
];

export default function PerpsFilterSheet({
  visible,
  filters,
  onClose,
  onApply,
}: {
  visible: boolean;
  filters: PerpsActivityFilters;
  onClose: () => void;
  onApply: (f: PerpsActivityFilters) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = theme.mode === 'dark';

  const [draft, setDraft] = useState<PerpsActivityFilters>(filters);
  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !filtersEqual(draft, DEFAULT_PERPS_ACTIVITY_FILTERS);
  const chipIdle = dark ? '#232640' : '#F5F5F7';
  const chipSel = dark ? 'rgba(108,99,255,0.30)' : 'rgba(108,99,255,0.12)';

  const toggleProvider = useCallback((key: string) => {
    setDraft((d) => ({ ...d, provider: d.provider === key ? null : (key as PerpsProvider) }));
  }, []);
  const toggleType = useCallback((key: string) => {
    setDraft((d) => ({
      ...d,
      type: d.type.includes(key as PerpsActivityType) ? d.type.filter((t) => t !== key) : [...d.type, key as PerpsActivityType],
    }));
  }, []);
  const toggleStatus = useCallback((key: string) => {
    setDraft((d) => ({
      ...d,
      status: d.status.includes(key as PerpsActivityStatus) ? d.status.filter((s) => s !== key) : [...d.status, key as PerpsActivityStatus],
    }));
  }, []);
  const toggleDate = useCallback((key: string) => {
    setDraft((d) => ({ ...d, date: d.date === key ? null : (key as PerpsActivityDate) }));
  }, []);
  const reset = useCallback(() => setDraft(DEFAULT_PERPS_ACTIVITY_FILTERS), []);
  const showResults = useCallback(() => {
    onApply(draft);
    onClose();
  }, [draft, onApply, onClose]);

  const Chip = ({ spec, selected, onPress }: { spec: ChipSpec; selected: boolean; onPress: () => void }) => {
    const Mark = spec.Mark;
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={[pfs.chip, { backgroundColor: selected ? chipSel : chipIdle, borderColor: selected ? theme.brand : 'transparent' }]}
      >
        {Mark ? <Mark size={15} /> : null}
        <Text style={[pfs.chipText, { color: selected ? theme.brand : theme.inkMuted }]}>{spec.label}</Text>
      </Pressable>
    );
  };

  return (
    <AppModal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      {/* dim scrim (Trust: page dims ~20%) */}
      <Pressable style={[pfs.root, { backgroundColor: dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.21)' }]} onPress={onClose} />

      <View style={[pfs.sheet, { backgroundColor: dark ? theme.surface : '#FFFFFF' }]}>
        {/* ---------- header: X circle, centred "Filter", Reset ---------- */}
        <View style={pfs.header}>
          <Pressable onPress={onClose} style={[pfs.circle, { backgroundColor: dark ? '#232640' : '#F0F0F2' }]} accessibilityLabel="Close filter">
            <CloseIcon size={18} color={theme.ink} />
          </Pressable>
          <View style={pfs.titleWrap} pointerEvents="none">
            <Text style={[pfs.title, { color: theme.ink }]}>Filter</Text>
          </View>
          <Pressable onPress={reset} hitSlop={12} disabled={!dirty}>
            <Text style={[pfs.reset, { color: dirty ? theme.brand : (dark ? '#5B5F78' : '#D0D0D8') }]}>Reset</Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={pfs.body} showsVerticalScrollIndicator={false}>
          {/* ---------- Provider ---------- */}
          <Text style={[pfs.label, { color: theme.ink }]}>Provider</Text>
          <View style={pfs.chipRow}>
            {PROVIDER_CHIPS.map((c) => (
              <Chip key={c.key} spec={c} selected={draft.provider === c.key} onPress={() => toggleProvider(c.key)} />
            ))}
          </View>

          {/* ---------- Assets ---------- */}
          <View style={pfs.assetsRow}>
            <Text style={[pfs.label, { color: theme.ink }]}>Assets</Text>
            <Text style={[pfs.select, { color: dark ? '#5B5F78' : '#D0D0D8' }]}>Select</Text>
            <ChevronRight size={15} color={dark ? '#5B5F78' : '#D0D0D8'} strokeWidth={2.4} />
          </View>

          {/* ---------- Type ---------- */}
          <Text style={[pfs.label, { color: theme.ink }]}>Type</Text>
          <View style={pfs.chipRow}>
            {TYPE_CHIPS.map((c) => (
              <Chip key={c.key} spec={c} selected={draft.type.includes(c.key as PerpsActivityType)} onPress={() => toggleType(c.key)} />
            ))}
          </View>

          {/* ---------- Show funding payment ---------- */}
          <View style={pfs.fundingRow}>
            <Text style={[pfs.fundingLabel, { color: theme.ink }]}>Show funding payment</Text>
            <Toggle value={draft.showFundingPayment} onChange={(v) => setDraft((d) => ({ ...d, showFundingPayment: v }))} />
          </View>

          {/* ---------- Status ---------- */}
          <Text style={[pfs.label, { color: theme.ink }]}>Status</Text>
          <View style={[pfs.chipRow, pfs.chipWrap]}>
            {STATUS_CHIPS.map((c) => (
              <Chip key={c.key} spec={c} selected={draft.status.includes(c.key as PerpsActivityStatus)} onPress={() => toggleStatus(c.key)} />
            ))}
          </View>

          {/* ---------- Date ---------- */}
          <Text style={[pfs.label, { color: theme.ink }]}>Date</Text>
          <View style={pfs.chipRow}>
            {DATE_CHIPS.map((c) => (
              <Chip key={c.key} spec={c} selected={draft.date === c.key} onPress={() => toggleDate(c.key)} />
            ))}
          </View>
        </ScrollView>

        {/* ---------- footer: Show results + drag handle ---------- */}
        <View style={[pfs.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {dirty ? (
            <PrimaryButton label="Show results" onPress={showResults} height={58} />
          ) : (
            <View style={[pfs.idleBtn, { backgroundColor: dark ? '#232640' : '#F8F8F8' }]}>
              <Text style={[T.buttonLarge, { color: dark ? '#5B5F78' : '#D0D0D8' }]}>Show results</Text>
            </View>
          )}
          <View style={[pfs.handle, { backgroundColor: dark ? '#3A3E5C' : '#E4E4E9' }]} />
        </View>
      </View>
    </AppModal>
  );
}

const pfs = StyleSheet.create({
  root: { flex: 1 },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SP.mdsm,
    overflow: 'hidden',
  },
  header: {
    height: 42,
    marginTop: 6,
    marginBottom: 14,
    marginHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { position: 'absolute', left: 0, right: 0, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT.semiBold, fontSize: 16, lineHeight: 22 },
  reset: { fontFamily: FONT.semiBold, fontSize: 16, lineHeight: 22, marginRight: 4 },

  body: { paddingHorizontal: 16, paddingBottom: SP.md },
  label: { ...T.heading, fontSize: 16, lineHeight: 22, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chipWrap: { marginBottom: 26 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    height: 34,
  },
  chipText: { fontFamily: FONT.medium, fontSize: 13, lineHeight: 18 },
  assetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 24,
    height: 22,
    justifyContent: 'space-between',
  },
  select: { fontFamily: FONT.medium, fontSize: 16, lineHeight: 22 },
  fundingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 30,
    marginBottom: 26,
  },
  fundingLabel: { fontFamily: FONT.medium, fontSize: 16, lineHeight: 22 },

  footer: { paddingHorizontal: 16, paddingTop: 6 },
  idleBtn: { height: 58, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    marginTop: 10,
    marginBottom: 2,
  },
  track: { width: 34, height: 22, borderRadius: 11, justifyContent: 'center' },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
});
