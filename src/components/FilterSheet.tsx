/**
 * Veltravia Wallet — Activity filters bottom sheet.
 *
 * Mirrors Trust Wallet's Activity filter sheet (measured from the
 * 2026-10-09 screen recording):
 *   - Bottom sheet over a ~20% dim scrim, rounded top corners.
 *   - Filters page: X circle (36dp, tertiary fill) + "Filters" title +
 *     "Reset"; Network row with value + chevron; two toggle rows;
 *     "Show results" 56dp full-width pill pinned at the bottom.
 *   - Reset is grey/inactive and Show results is a pale disabled pill
 *     until something differs from the defaults (both toggles ON,
 *     All networks). Dirty state enables both.
 *   - Networks sub-page swaps INSIDE the same sheet: back circle,
 *     "Networks" + subtitle ("All" / "N selected"), search field,
 *     "All networks" row (globe) with check, Popular list with real
 *     chain marks, "Apply" pill.
 *
 * Brand: Veltravia violet (#6C63FF) replaces Trust's blue-violet for
 * toggles/checks; primary pills use the brand gradient.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { FONT, T, SP, RADIUS, TOUCH } from '../theme/typography';
import {
  BackIcon,
  CheckIcon,
  ChevronRight,
  CloseIcon,
  GlobeIcon,
  SearchIcon,
  CoinEth,
  CoinBnb,
  CoinPolygon,
  CoinSolana,
} from './icons';

export interface ActivityFilters {
  hideSmallReceives: boolean;
  hideContractInteractions: boolean;
  /** null = All networks; otherwise a list of network ids. */
  networks: string[] | null;
}

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = {
  hideSmallReceives: true,
  hideContractInteractions: true,
  networks: null,
};

interface NetworkDef {
  id: string;
  name: string;
  Mark: React.ComponentType<{ size?: number }>;
}

const NETWORKS: NetworkDef[] = [
  { id: 'ethereum', name: 'Ethereum', Mark: CoinEth },
  { id: 'bnb', name: 'BNB Smart Chain', Mark: CoinBnb },
  { id: 'polygon', name: 'Polygon', Mark: CoinPolygon },
  { id: 'solana', name: 'Solana', Mark: CoinSolana },
];

function filtersEqual(a: ActivityFilters, b: ActivityFilters): boolean {
  if (a.hideSmallReceives !== b.hideSmallReceives) return false;
  if (a.hideContractInteractions !== b.hideContractInteractions) return false;
  const an = a.networks ?? [];
  const bn = b.networks ?? [];
  if (an.length !== bn.length) return false;
  return an.every((n) => bn.includes(n));
}

/** Trust-style toggle: ~46x28 track, 24 knob, animated 160ms. */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [value, anim]);
  const knobLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 20] });
  const trackOn = theme.brand;
  const trackOff = theme.mode === 'dark' ? '#1C1E4A' : '#E9E7FF';
  return (
    <Pressable hitSlop={8} onPress={() => onChange(!value)} accessibilityRole="switch">
      <Animated.View style={[tgStyles.track, { backgroundColor: value ? trackOn : trackOff }]}>
        <Animated.View style={[tgStyles.knob, { left: knobLeft }]} />
      </Animated.View>
    </Pressable>
  );
}

const tgStyles = StyleSheet.create({
  track: { width: 46, height: 28, borderRadius: 14, padding: 2 },
  knob: { position: 'absolute', top: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
});

export default function FilterSheet({
  visible,
  filters,
  onClose,
  onApply,
}: {
  visible: boolean;
  filters: ActivityFilters;
  onClose: () => void;
  onApply: (f: ActivityFilters) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = theme.mode === 'dark';

  const [page, setPage] = useState<'filters' | 'networks'>('filters');
  const [draft, setDraft] = useState<ActivityFilters>(filters);
  const [query, setQuery] = useState('');

  // Re-sync the draft every time the sheet opens.
  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setPage('filters');
      setQuery('');
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !filtersEqual(draft, DEFAULT_ACTIVITY_FILTERS);

  const toggleSmall = useCallback(() => setDraft((d) => ({ ...d, hideSmallReceives: !d.hideSmallReceives })), []);
  const toggleContract = useCallback(
    () => setDraft((d) => ({ ...d, hideContractInteractions: !d.hideContractInteractions })),
    [],
  );

  const networkValue = draft.networks === null ? 'All' : `${draft.networks.length} selected`;

  const filteredNetworks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NETWORKS;
    return NETWORKS.filter((n) => n.name.toLowerCase().includes(q));
  }, [query]);

  const toggleNetwork = useCallback((id: string) => {
    setDraft((d) => {
      if (d.networks === null) return { ...d, networks: [id] };
      if (d.networks.includes(id)) {
        const next = d.networks.filter((n) => n !== id);
        return { ...d, networks: next.length ? next : null };
      }
      return { ...d, networks: [...d.networks, id] };
    });
  }, []);
  const selectAll = useCallback(() => setDraft((d) => ({ ...d, networks: null })), []);

  const reset = useCallback(() => setDraft(DEFAULT_ACTIVITY_FILTERS), []);
  const applyNetworks = useCallback(() => setPage('filters'), []);
  const showResults = useCallback(() => {
    onApply(draft);
    onClose();
  }, [draft, onApply, onClose]);

  const sheetBg = dark ? theme.surface : '#FFFFFF';
  const tertiary = theme.surfaceAlt;
  const hairline = theme.border;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* dim scrim (Trust: page dims ~20%) */}
        <Pressable style={[fs.root, { backgroundColor: dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)' }]} onPress={onClose} />

        <View style={[fs.sheet, { backgroundColor: sheetBg, paddingBottom: insets.bottom + SP.xs }]}>
          {page === 'filters' ? (
            <>
              {/* ---------- header ---------- */}
              <View style={fs.headerRow}>
                <Pressable hitSlop={10} onPress={onClose} style={[fs.circle, { backgroundColor: tertiary }]}>
                  <CloseIcon size={20} color={theme.ink} />
                </Pressable>
                <Text style={[fs.sheetTitle, { color: theme.ink }]}>Filters</Text>
                <Pressable hitSlop={12} onPress={reset} disabled={!dirty}>
                  <Text style={[T.buttonLarge, { color: dirty ? theme.brand : theme.inkMuted }]}>Reset</Text>
                </Pressable>
              </View>

              {/* ---------- Network row ---------- */}
              <Pressable style={({ pressed }) => [fs.row, { opacity: pressed ? 0.6 : 1 }]} onPress={() => setPage('networks')}>
                <Text style={[T.subtitle, { color: theme.ink }]}>Network</Text>
                <View style={fs.rowRight}>
                  <Text style={[T.subtitle, { color: theme.inkMuted }]}>{networkValue}</Text>
                  <ChevronRight size={16} color={theme.inkMuted} strokeWidth={2.4} />
                </View>
              </Pressable>
              <View style={[fs.hairline, { backgroundColor: hairline }]} />

              {/* ---------- toggle rows ---------- */}
              <Pressable style={fs.row} onPress={toggleSmall}>
                <Text style={[T.subtitle, { color: theme.ink }]}>Hide small receives</Text>
                <Toggle value={draft.hideSmallReceives} onChange={toggleSmall} />
              </Pressable>
              <View style={[fs.hairline, { backgroundColor: hairline }]} />
              <Pressable style={fs.row} onPress={toggleContract}>
                <Text style={[T.subtitle, { color: theme.ink }]}>Hide contract interactions</Text>
                <Toggle value={draft.hideContractInteractions} onChange={toggleContract} />
              </Pressable>

              {/* ---------- Show results ---------- */}
              <View style={{ paddingHorizontal: SP.mdsm, marginTop: SP.mdsm }}>
                {dirty ? (
                  <Pressable onPress={showResults} style={({ pressed }) => [fs.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}>
                    <LinearGradient
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      colors={theme.brandGradient as unknown as [string, string]}
                      style={fs.gradient}
                    >
                      <Text style={fs.primaryText}>Show results</Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <View style={[fs.primaryBtn, { backgroundColor: tertiary }]}>
                    <Text style={[T.buttonLarge, { color: theme.inkMuted }]}>Show results</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              {/* ---------- header with subtitle ---------- */}
              <View style={fs.headerRow}>
                <Pressable hitSlop={10} onPress={() => setPage('filters')} style={[fs.circle, { backgroundColor: tertiary }]}>
                  <BackIcon size={20} color={theme.ink} />
                </Pressable>
                <View style={fs.titleCol}>
                  <Text style={[fs.sheetTitle, { color: theme.ink }]}>Networks</Text>
                  <Text style={[T.footnote, { color: theme.inkMuted, marginTop: -2 }]}>{networkValue}</Text>
                </View>
                <View style={{ width: 42 }} />
              </View>

              {/* ---------- search ---------- */}
              <View style={[fs.searchWrap, { backgroundColor: tertiary }]}>
                <SearchIcon size={18} color={theme.inkMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search"
                  placeholderTextColor={theme.inkMuted}
                  style={[fs.searchInput, { color: theme.ink }]}
                  returnKeyType="search"
                />
              </View>

              {/* ---------- list ---------- */}
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: SP.sm }} showsVerticalScrollIndicator={false}>
                <Pressable style={fs.netRow} onPress={selectAll}>
                  <View style={[fs.netIcon, { backgroundColor: tertiary }]}>
                    <GlobeIcon size={22} color={theme.ink} />
                  </View>
                  <Text style={[T.subtitle, { color: theme.ink, flex: 1 }]}>All networks</Text>
                  {draft.networks === null && <CheckIcon size={22} color={theme.brand} />}
                </Pressable>
                <View style={[fs.hairline, { backgroundColor: hairline }]} />

                <Text style={[fs.sectionLabel, { color: theme.ink }]}>Popular</Text>
                {filteredNetworks.map((n) => {
                  const selected = draft.networks?.includes(n.id) ?? false;
                  const Mark = n.Mark;
                  return (
                    <Pressable key={n.id} style={fs.netRow} onPress={() => toggleNetwork(n.id)}>
                      <Mark size={40} />
                      <Text style={[T.subtitle, { color: theme.ink, flex: 1 }]}>{n.name}</Text>
                      {selected && <CheckIcon size={22} color={theme.brand} />}
                    </Pressable>
                  );
                })}
                {filteredNetworks.length === 0 && (
                  <Text style={[fs.noMatch, { color: theme.inkMuted }]}>No networks found</Text>
                )}
              </ScrollView>

              {/* ---------- Apply ---------- */}
              <View style={{ paddingHorizontal: SP.mdsm, paddingTop: SP.sm }}>
                <Pressable onPress={applyNetworks} style={({ pressed }) => [fs.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}>
                  <LinearGradient
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    colors={theme.brandGradient as unknown as [string, string]}
                    style={fs.gradient}
                  >
                    <Text style={fs.primaryText}>Apply</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const fs = StyleSheet.create({
  root: { flex: 1 },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    paddingHorizontal: SP.mdsm,
    paddingTop: SP.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: SP.xxs,
  },
  titleCol: { alignItems: 'center' },
  circle: { width: TOUCH.headerCircle, height: TOUCH.headerCircle, borderRadius: TOUCH.headerCircle / 2, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { ...T.heading, fontSize: 17 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: SP.xxs,
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: SP.xxs },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: SP.xxs },

  primaryBtn: { height: TOUCH.buttonLarge, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gradient: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...T.buttonLarge, color: '#FFFFFF' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.sm,
    height: 44,
    borderRadius: RADIUS.mdsm,
    paddingHorizontal: SP.mdsm,
    marginBottom: SP.sm,
  },
  searchInput: { flex: 1, fontFamily: FONT.medium, fontSize: 15, padding: 0 },

  netRow: { flexDirection: 'row', alignItems: 'center', gap: SP.md, height: 60, paddingHorizontal: SP.xxs },
  netIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { ...T.emphasis, marginTop: SP.mdsm, marginBottom: SP.xxs, paddingHorizontal: SP.xxs },
  noMatch: { ...T.body, textAlign: 'center', paddingVertical: SP.lg },
});
