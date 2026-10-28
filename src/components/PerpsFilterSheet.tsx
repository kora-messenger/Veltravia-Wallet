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
 * Chips (measured from the 10:44 recording): idle #EFEEF1 fill with muted
 * grey text; SELECTED = darker grey fill (#CECED6) with near-black text and
 * NO border / no brand tint. Reset: pale grey when clean, near-black once
 * anything is selected (not a brand colour). Show results: pale (#F8F7FA /
 * #C8C9CE text) when clean, solid brand once dirty. The Assets row's
 * "Select" is grey with a near-black chevron.
 *
 * Date > Custom: the sheet grows upward (to ~116px from the top) and shows
 * Start / End fields (rounded #EFEEF1, small grey label, bold value, calendar
 * icon). Tapping a field opens the native Android Material date dialog then
 * the clock (DateTimePickerModule.kt); defaults are now-7d -> now. The sheet
 * scrolls when it outgrows the screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import AppModal from './AppModal';
import PrimaryButton from './PrimaryButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, ChevronRight, DocIcon, CardIcon, SwapIcon, CalendarIcon } from './icons';
import { pickDateTime, formatRangeStamp } from '../core/dateTimePicker';
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
  /** epoch ms; only meaningful when date === 'custom'. */
  customStart: number | null;
  customEnd: number | null;
}

export const DEFAULT_PERPS_ACTIVITY_FILTERS: PerpsActivityFilters = {
  provider: null,
  assets: [],
  type: [],
  showFundingPayment: false,
  status: [],
  date: null,
  customStart: null,
  customEnd: null,
};

/** True when any filter differs from the defaults (also drives the header button's dot). */
export function perpsFiltersActive(f: PerpsActivityFilters): boolean {
  return !filtersEqual(f, DEFAULT_PERPS_ACTIVITY_FILTERS);
}

function filtersEqual(a: PerpsActivityFilters, b: PerpsActivityFilters): boolean {
  return (
    a.provider === b.provider &&
    a.type.length === b.type.length &&
    a.type.every((t) => b.type.includes(t)) &&
    a.showFundingPayment === b.showFundingPayment &&
    a.status.length === b.status.length &&
    a.status.every((s) => b.status.includes(s)) &&
    a.date === b.date &&
    (a.date !== 'custom' || (a.customStart === b.customStart && a.customEnd === b.customEnd))
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
  Mark?: React.ComponentType<{ size?: number; color?: string }>;
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
  const chipIdle = dark ? '#232640' : '#EFEEF1';
  const chipSel = dark ? '#3A3E5C' : '#CECED6';   // Trust: darker grey, not a brand tint
  const chipTextIdle = dark ? '#9A9EB5' : '#818685';
  const chipTextSel = dark ? '#FFFFFF' : '#080D13';
  const mutedPale = dark ? '#5B5F78' : '#CECDD0';

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
    setDraft((d) => {
      if (d.date === key) return { ...d, date: null };
      if (key !== 'custom') return { ...d, date: key as PerpsActivityDate };
      const end = d.customEnd ?? Date.now();
      return { ...d, date: 'custom', customEnd: end, customStart: d.customStart ?? end - 7 * 86400000 };
    });
  }, []);
  const editRange = useCallback(async (which: 'start' | 'end') => {
    const cur = which === 'start' ? draft.customStart : draft.customEnd;
    const picked = await pickDateTime({
      initial: cur ?? Date.now(),
      max: which === 'start' ? undefined : undefined,
    });
    if (picked == null) return;
    setDraft((d) => {
      const next = { ...d, [which === 'start' ? 'customStart' : 'customEnd']: picked } as PerpsActivityFilters;
      // keep start <= end (the later one drags the other along)
      if (next.customStart != null && next.customEnd != null && next.customStart > next.customEnd) {
        if (which === 'start') next.customEnd = next.customStart;
        else next.customStart = next.customEnd;
      }
      return next;
    });
  }, [draft.customStart, draft.customEnd]);
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
        style={[pfs.chip, { backgroundColor: selected ? chipSel : chipIdle }]}
      >
        {Mark ? <Mark size={15} color={selected ? chipTextSel : chipTextIdle} /> : null}
        <Text style={[pfs.chipText, { color: selected ? chipTextSel : chipTextIdle }]}>{spec.label}</Text>
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
            <Text style={[pfs.reset, { color: dirty ? theme.ink : mutedPale }]}>Reset</Text>
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
            <View style={pfs.selectWrap}>
              <Text style={[pfs.select, { color: dark ? '#9A9EB5' : '#83838B' }]}>Select</Text>
              <ChevronRight size={18} color={theme.ink} strokeWidth={2.4} />
            </View>
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

          {draft.date === 'custom' ? (
            <View style={pfs.rangeWrap}>
              {([['Start', draft.customStart, 'start'], ['End', draft.customEnd, 'end']] as const).map(([label, ms, which]) => (
                <View key={which} style={{ marginBottom: 12 }}>
                  <Text style={[pfs.rangeLabel, { color: dark ? '#9A9EB5' : '#7E7E88' }]}>{label}</Text>
                  <Pressable
                    onPress={() => editRange(which)}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} date`}
                    style={[pfs.rangeField, { backgroundColor: chipIdle }]}
                  >
                    <Text style={[pfs.rangeValue, { color: theme.ink }]}>{ms != null ? formatRangeStamp(ms) : ''}</Text>
                    <CalendarIcon size={22} color={dark ? '#9A9EB5' : '#7E7E88'} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>

        {/* ---------- footer: Show results + drag handle ---------- */}
        <View style={[pfs.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {dirty ? (
            <PrimaryButton label="Show results" onPress={showResults} height={58} />
          ) : (
            <View style={[pfs.idleBtn, { backgroundColor: dark ? '#232640' : '#F8F7FA' }]}>
              <Text style={[T.buttonLarge, { color: dark ? '#5B5F78' : '#C8C9CE' }]}>Show results</Text>
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
    maxHeight: '90%',
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
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 36,
  },
  chipText: { fontFamily: FONT.medium, fontSize: 14, lineHeight: 18 },
  rangeWrap: { marginTop: -6, marginBottom: 8 },
  rangeLabel: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 18, marginBottom: 6 },
  rangeField: {
    height: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rangeValue: { fontFamily: FONT.semiBold, fontSize: 17, lineHeight: 22 },
  assetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    height: 22,
    justifyContent: 'space-between',
  },
  selectWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
