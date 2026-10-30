/**
 * Veltravia Wallet - Perps Activity "Filter" bottom sheet.
 *
 * Built from the 10:43/10:44 Trust recording (1080px wide = 2.625px per dp).
 * Measured off it, not estimated: button 157px = 60dp tall and 16dp from each
 * side, chips ~30dp tall (pill), sections separated by hairline dividers,
 * "Show results" #392EFA when active, the sheet top ~202dp below the status bar.
 *
 * Three areas that never overlap:
 *   A  fixed header      close circle, centred "Filter", Reset
 *   B  scrolling body    Provider / Assets / Type / funding / Status / Date
 *   C  fixed footer      "Show results" (+ the system-gesture inset)
 * Only B scrolls. The sheet has a fixed height, so opening Custom dates grows
 * the scroll content, never the header or the button.
 *
 * Assets opens the picker INSIDE this same sheet (no second modal): it lists
 * the markets the app really supports and hands the selection back.
 *
 * The meaning of a filter (and the filtering itself) lives in
 * core/perps/activityFilters.ts, which is unit tested; this file is the UI.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated, Easing, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppModal from './AppModal';
import PerpsAssetPicker from './PerpsAssetPicker';
import { useTheme } from '../theme/ThemeProvider';
import { CloseIcon, ChevronRight, DocIcon, CardIcon, SwapIcon, CalendarIcon } from './icons';
import { pickDateTime, formatRangeStamp } from '../core/dateTimePicker';
import { HyperliquidTile, AsterTile } from './PerpsVenueMarks';
import { showToast } from './Toast';
import { FONT } from '../theme/typography';
import {
  DEFAULT_PERPS_ACTIVITY_FILTERS, filtersEqual, clampRange,
  type PerpsActivityFilters, type PerpsProvider, type PerpsActivityType,
  type PerpsActivityStatus, type PerpsActivityDate,
} from '../core/perps/activityFilters';

// Re-exported so existing imports keep working.
export {
  DEFAULT_PERPS_ACTIVITY_FILTERS, perpsFiltersActive,
} from '../core/perps/activityFilters';
export type {
  PerpsActivityFilters, PerpsProvider, PerpsActivityType, PerpsActivityStatus, PerpsActivityDate,
} from '../core/perps/activityFilters';

const BRAND = '#392EFA';           // "Show results" in the recording (sampled)
const DAY = 86_400_000;

/** Track 34x22, knob 18; the knob slides, the track colour eases. */
function Toggle({ value, onChange, dark }: { value: boolean; onChange: (v: boolean) => void; dark: boolean }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [value, anim]);
  const off = dark ? '#2A2D55' : '#D9D9E0';
  return (
    <Pressable
      hitSlop={12}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel="Show funding payment"
      accessibilityState={{ checked: value }}
      testID="fundingToggle"
    >
      <Animated.View
        style={[s.track, { backgroundColor: anim.interpolate({ inputRange: [0, 1], outputRange: [off, BRAND] }) }]}
      >
        <Animated.View style={[s.knob, { transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [2, 14] }) }] }]} />
      </Animated.View>
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

const toggleIn = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

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
  const { height: screenH } = useWindowDimensions();
  const dark = theme.mode === 'dark';

  const [draft, setDraft] = useState<PerpsActivityFilters>(filters);
  const [view, setView] = useState<'filters' | 'assets'>('filters');
  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setView('filters');
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !filtersEqual(draft, DEFAULT_PERPS_ACTIVITY_FILTERS);
  const ink = dark ? '#FFFFFF' : '#080D13';
  const chipIdle = dark ? '#232640' : '#EFEEF1';
  const chipSel = dark ? '#3A3E5C' : '#CECED6';
  // reference grey is #818685 (3.2:1 on the chip); #686C6F keeps the muted look and passes 4.5:1
  const chipTextIdle = dark ? '#A9ADC2' : '#686C6F';
  const divider = dark ? 'rgba(255,255,255,0.08)' : '#EFEFF3';
  const mutedPale = dark ? '#5B5F78' : '#CECDD0';

  // Fixed height: the header and footer never move when the body grows.
  const sheetH = Math.min(Math.round(screenH * 0.9), screenH - insets.top - 24);

  // Slide-up with a fading scrim, driven here so close is just as smooth.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, enter]);
  const closeAnimated = useCallback((after?: () => void) => {
    Animated.timing(enter, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      onClose();
      after?.();
    });
  }, [enter, onClose]);

  const reset = useCallback(() => setDraft(DEFAULT_PERPS_ACTIVITY_FILTERS), []);

  const pickDate = useCallback((key: string) => {
    setDraft((d) => {
      if (d.date === key) return { ...d, date: null };
      if (key !== 'custom') return { ...d, date: key as PerpsActivityDate };
      const end = d.customEnd ?? Date.now();
      return { ...d, date: 'custom', customEnd: end, customStart: d.customStart ?? end - 7 * DAY };
    });
  }, []);

  const editRange = useCallback(async (which: 'start' | 'end') => {
    const cur = which === 'start' ? draft.customStart : draft.customEnd;
    const picked = await pickDateTime({
      initial: cur ?? Date.now(),
      // the native dialog greys out what would break the rule
      ...(which === 'start' && draft.customEnd != null ? { max: draft.customEnd } : {}),
      ...(which === 'end' && draft.customStart != null ? { min: draft.customStart } : {}),
    });
    if (picked == null) return;
    setDraft((d) => {
      const start = which === 'start' ? picked : d.customStart ?? picked;
      const end = which === 'end' ? picked : d.customEnd ?? picked;
      const fixed = clampRange(which, start, end);
      if (fixed.start !== start || fixed.end !== end) {
        showToast(
          which === 'start' ? 'Start can’t be after the end date. End moved to match.' : 'End can’t be before the start date. Start moved to match.',
          { kind: 'info', duration: 2600 },
        );
      }
      return { ...d, customStart: fixed.start, customEnd: fixed.end };
    });
  }, [draft.customStart, draft.customEnd]);

  const showResults = useCallback(() => {
    onApply(draft);
    closeAnimated();
  }, [draft, onApply, closeAnimated]);

  const Chip = ({ spec, selected, onPress }: { spec: ChipSpec; selected: boolean; onPress: () => void }) => {
    const Mark = spec.Mark;
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={spec.label}
        accessibilityState={{ selected }}
        testID={`chip-${spec.key}`}
        style={({ pressed }) => [s.chip, { backgroundColor: selected ? chipSel : chipIdle, opacity: pressed ? 0.75 : 1 }]}
      >
        {Mark ? <Mark size={16} color={selected ? ink : chipTextIdle} /> : null}
        <Text style={[s.chipText, { color: selected ? ink : chipTextIdle }]}>{spec.label}</Text>
      </Pressable>
    );
  };

  const Divider = () => <View style={[s.divider, { backgroundColor: divider }]} />;

  const assetsLabel = draft.assets.length
    ? draft.assets.length === 1 ? draft.assets[0] : `${draft.assets.length} selected`
    : 'Select';

  return (
    <AppModal visible={visible} animationType="none" transparent onRequestClose={() => (view === 'assets' ? setView('filters') : closeAnimated())} statusBarTranslucent>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.21)', opacity: enter }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeAnimated()} accessibilityLabel="Close filter" />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          {
            height: sheetH,
            backgroundColor: dark ? theme.surface : '#FFFFFF',
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [sheetH, 0] }) }],
          },
        ]}
        testID="perpsFilterSheet"
      >
        {view === 'assets' ? (
          <PerpsAssetPicker
            selected={draft.assets}
            providers={draft.providers}
            onBack={() => setView('filters')}
            onDone={(assets) => {
              setDraft((d) => ({ ...d, assets }));
              setView('filters');
            }}
          />
        ) : (
          <>
            {/* A - fixed header */}
            <View style={s.header} testID="filterHeader">
              <Pressable
                onPress={() => closeAnimated()}
                style={[s.circle, { backgroundColor: dark ? '#232640' : '#F0F0F2' }]}
                accessibilityLabel="Close filter"
                hitSlop={8}
                testID="filterClose"
              >
                <CloseIcon size={18} color={ink} />
              </Pressable>
              <View style={s.titleWrap} pointerEvents="none">
                <Text style={[s.title, { color: ink }]}>Filter</Text>
              </View>
              <Pressable onPress={reset} hitSlop={12} disabled={!dirty} accessibilityLabel="Reset filters" testID="filterReset">
                <Text style={[s.reset, { color: dirty ? ink : mutedPale }]}>Reset</Text>
              </Pressable>
            </View>

            {/* B - the only part that scrolls */}
            <ScrollView
              style={s.bodyScroll}
              contentContainerStyle={s.body}
              showsVerticalScrollIndicator={false}
              testID="filterBody"
            >
              <Text style={[s.label, { color: ink }]}>Provider</Text>
              <View style={s.chipRow}>
                {PROVIDER_CHIPS.map((c) => (
                  <Chip
                    key={c.key}
                    spec={c}
                    selected={draft.providers.includes(c.key as PerpsProvider)}
                    onPress={() => setDraft((d) => ({ ...d, providers: toggleIn(d.providers, c.key as PerpsProvider) }))}
                  />
                ))}
              </View>
              <Divider />

              <Pressable
                style={s.assetsRow}
                onPress={() => setView('assets')}
                accessibilityRole="button"
                accessibilityLabel={`Assets, ${assetsLabel}`}
                testID="assetsRow"
              >
                <Text style={[s.label, s.noMargin, { color: ink }]}>Assets</Text>
                <View style={s.selectWrap}>
                  <Text style={[s.select, { color: draft.assets.length ? ink : dark ? '#A9ADC2' : '#6E6E76' }]} testID="assetsValue">
                    {assetsLabel}
                  </Text>
                  <ChevronRight size={18} color={ink} strokeWidth={2.4} />
                </View>
              </Pressable>
              <Divider />

              <Text style={[s.label, { color: ink }]}>Type</Text>
              <View style={s.chipRow}>
                {TYPE_CHIPS.map((c) => (
                  <Chip
                    key={c.key}
                    spec={c}
                    selected={draft.type.includes(c.key as PerpsActivityType)}
                    onPress={() => setDraft((d) => ({ ...d, type: toggleIn(d.type, c.key as PerpsActivityType) }))}
                  />
                ))}
              </View>
              <Divider />

              <View style={s.fundingRow}>
                <Text style={[s.fundingLabel, { color: ink }]}>Show funding payment</Text>
                <Toggle dark={dark} value={draft.showFundingPayment} onChange={(v) => setDraft((d) => ({ ...d, showFundingPayment: v }))} />
              </View>
              <Divider />

              <Text style={[s.label, { color: ink }]}>Status</Text>
              <View style={s.chipRow}>
                {STATUS_CHIPS.map((c) => (
                  <Chip
                    key={c.key}
                    spec={c}
                    selected={draft.status.includes(c.key as PerpsActivityStatus)}
                    onPress={() => setDraft((d) => ({ ...d, status: toggleIn(d.status, c.key as PerpsActivityStatus) }))}
                  />
                ))}
              </View>
              <Divider />

              <Text style={[s.label, { color: ink }]}>Date</Text>
              <View style={s.chipRow}>
                {DATE_CHIPS.map((c) => (
                  <Chip key={c.key} spec={c} selected={draft.date === c.key} onPress={() => pickDate(c.key)} />
                ))}
              </View>

              {draft.date === 'custom' ? (
                <View testID="customRange">
                  {([['Start', draft.customStart, 'start'], ['End', draft.customEnd, 'end']] as const).map(([label, ms, which]) => (
                    <View key={which} style={{ marginBottom: 12 }}>
                      <Text style={[s.rangeLabel, { color: dark ? '#A9ADC2' : '#6E6E78' }]}>{label}</Text>
                      <Pressable
                        onPress={() => editRange(which)}
                        accessibilityRole="button"
                        accessibilityLabel={`${label} date and time`}
                        testID={`range-${which}`}
                        style={({ pressed }) => [s.rangeField, { backgroundColor: chipIdle, opacity: pressed ? 0.8 : 1 }]}
                      >
                        <Text style={[s.rangeValue, { color: ink }]} testID={`range-${which}-value`}>
                          {ms != null ? formatRangeStamp(ms) : ''}
                        </Text>
                        <CalendarIcon size={22} color={dark ? '#9A9EB5' : '#7E7E88'} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            {/* C - fixed footer */}
            <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]} testID="filterFooter">
              <Pressable
                onPress={showResults}
                accessibilityRole="button"
                accessibilityLabel="Show results"
                testID="showResults"
                style={({ pressed }) => [s.cta, { backgroundColor: BRAND, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={s.ctaText}>Show results</Text>
              </Pressable>
            </View>
          </>
        )}
      </Animated.View>
    </AppModal>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingTop: 10, overflow: 'hidden',
  },
  header: {
    height: 42, marginTop: 6, marginBottom: 10, marginHorizontal: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  circle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { position: 'absolute', left: 0, right: 0, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT.bold, fontSize: 17, lineHeight: 22 },
  reset: { fontFamily: FONT.semiBold, fontSize: 16, lineHeight: 22, marginRight: 4 },

  bodyScroll: { flex: 1 },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  label: { fontFamily: FONT.semiBold, fontSize: 16, lineHeight: 22, marginTop: 14, marginBottom: 10 },
  noMargin: { marginTop: 0, marginBottom: 0 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginTop: 14, marginHorizontal: -16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 34, paddingHorizontal: 14, borderRadius: 17,
  },
  chipText: { fontFamily: FONT.medium, fontSize: 14, lineHeight: 18 },

  assetsRow: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  selectWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  select: { fontFamily: FONT.medium, fontSize: 16, lineHeight: 22 },

  fundingRow: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  fundingLabel: { fontFamily: FONT.semiBold, fontSize: 16, lineHeight: 22 },
  track: { width: 36, height: 22, borderRadius: 11, justifyContent: 'center' },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },

  rangeLabel: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 18, marginTop: 14, marginBottom: 6 },
  rangeField: {
    height: 56, borderRadius: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rangeValue: { fontFamily: FONT.semiBold, fontSize: 17, lineHeight: 22 },

  footer: { paddingHorizontal: 16, paddingTop: 10 },
  cta: { height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontFamily: FONT.bold, fontSize: 17, lineHeight: 22 },
});
