/**
 * Veltravia Wallet — Perps "Search market" (Trust parity).
 *
 * Opened from the search icon on the Perps home. A full-screen market browser:
 *   - star tab (favorites) + the section tabs (Popular, New, Crypto, Stocks...)
 *   - "All providers" and "Volume (24h)" filter chips, each opening a picker
 *   - the market list (same rows as the home), with a brief loading spinner
 *     when switching tab, like Trust
 *   - a bottom "Search market" bar; typing narrows the current tab; the X
 *     clears the text first, then closes the screen
 *
 * Provider filter respects Settings > Perps "Show in markets": a hidden
 * venue never appears here either.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, FlatList, TextInput, ActivityIndicator, Keyboard, Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import Sparkline from '../components/Sparkline';
import AppModal from '../components/AppModal';
import { HyperliquidTile, AsterTile } from '../components/PerpsVenueMarks';
import {
  SearchIcon, CloseIcon, StarIcon, ChevronDownIcon, SortArrowIcon, CheckIcon, COIN_ICONS,
} from '../components/icons';
import { formatPerpPrice, formatChange, perpSpark, type PerpMarket } from '../services/perpsMarkets';
import { useVenuePrefs } from '../services/perpsVenues';
import { usePerpsFavorites, toggleFavorite, loadPerpsFavorites } from '../services/perpsFavorites';
import {
  SEARCH_TABS, FAVORITES_TAB, SORT_OPTIONS, queryMarkets, favKey, defaultDir,
  type ProviderFilter, type SortKey, type SortDir,
} from '../services/perpsSearch';

const GREEN = '#158444';
const RED = '#D63232';
const VIOLET_DEEP = '#5147E6';
/** Brief per-tab loading (Trust shows a spinner between tabs). */
export const TAB_LOAD_MS = 450;

function MarketLogo({ m }: { m: PerpMarket }) {
  const Coin = COIN_ICONS[m.symbol];
  if (Coin) return <Coin size={44} />;
  const tile = m.tile ?? { bg: '#E9EAEE', fg: '#555A66', text: m.symbol[0] };
  return (
    <View style={[styles.logo, { backgroundColor: tile.bg }]}>
      <Text style={{ color: tile.fg, fontSize: tile.text.length > 2 ? 11 : 18, fontFamily: 'Inter-700', fontWeight: '700' }}>
        {tile.text}
      </Text>
    </View>
  );
}

export default function PerpsSearchScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const hl = useVenuePrefs('hyperliquid');
  const aster = useVenuePrefs('aster');
  const favorites = usePerpsFavorites();

  const [tab, setTab] = useState<string>('popular');
  const [provider, setProvider] = useState<ProviderFilter>('all');
  const [sort, setSort] = useState<SortKey>('volume');
  const [dir, setDir] = useState<SortDir>('desc');
  const [query, setQuery] = useState('');
  const [picker, setPicker] = useState<null | 'provider' | 'sort'>(null);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  useEffect(() => { loadPerpsFavorites(); }, []);

  // brief spinner when switching tab (not on first paint)
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setLoading(true);
    const t = setTimeout(() => setLoading(false), TAB_LOAD_MS);
    return () => clearTimeout(t);
  }, [tab]);

  const rows = useMemo(
    () => queryMarkets({
      tab, provider, query, sort, dir, favorites,
      venueVisible: { hyperliquid: hl.showInMarkets, aster: aster.showInMarkets },
    }),
    [tab, provider, query, sort, dir, favorites, hl.showInMarkets, aster.showInMarkets],
  );

  const close = () => { Keyboard.dismiss(); navigation.goBack(); };
  const onX = () => (query ? setQuery('') : close());

  const chipBg = dark ? '#1D2133' : '#F0F0F3';
  const muted = theme.inkMuted;
  const leverageBg = dark ? 'rgba(255,255,255,0.10)' : '#EEEEF3';
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)!.label;
  const providerLabel = provider === 'all' ? 'All providers' : provider === 'hyperliquid' ? 'Hyperliquid' : 'Aster';

  const emptyText = tab === FAVORITES_TAB && !query
    ? 'No favorites yet. Tap the star on a market to add it.'
    : 'No markets found';

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 6 }]}>
      {/* tab strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        <Pressable
          accessibilityLabel="Favorites"
          onPress={() => { Vibration.vibrate(10); setTab(FAVORITES_TAB); }}
          style={[styles.tab, tab === FAVORITES_TAB && { backgroundColor: dark ? '#252A3D' : '#E7E7EC' }]}
        >
          <StarIcon size={22} color={tab === FAVORITES_TAB ? theme.ink : muted} filled={tab === FAVORITES_TAB} />
        </Pressable>
        {SEARCH_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              accessibilityLabel={`Tab ${t.title}`}
              onPress={() => { Vibration.vibrate(10); setTab(t.key); }}
              style={[styles.tab, active && { backgroundColor: dark ? '#252A3D' : '#E7E7EC' }]}
            >
              <Text style={[styles.tabText, { color: active ? theme.ink : muted }]}>{t.title}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* filter chips */}
      <View style={styles.filters}>
        <Pressable accessibilityLabel="All providers" onPress={() => setPicker('provider')} style={[styles.chip, { backgroundColor: chipBg }]}>
          <View style={styles.marks}>
            <HyperliquidTile size={20} />
            <View style={{ marginLeft: -6 }}><AsterTile size={20} /></View>
          </View>
          <Text style={[styles.chipText, { color: muted }]}>{providerLabel}</Text>
          <ChevronDownIcon size={16} color={muted} />
        </Pressable>
        <Pressable accessibilityLabel="Sort" onPress={() => setPicker('sort')} style={[styles.chip, { backgroundColor: chipBg }]}>
          <Text style={[styles.chipText, { color: muted }]}>{sortLabel}</Text>
          <SortArrowIcon size={16} color={muted} up={dir === 'asc'} />
        </Pressable>
      </View>

      {/* list */}
      {loading ? (
        <View style={styles.center} accessibilityLabel="Loading markets">
          <ActivityIndicator color={muted} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: muted }]}>{emptyText}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
          renderItem={({ item }) => {
            const m = item.market;
            const up = m.change24h >= 0;
            const col = up ? GREEN : RED;
            const fav = favorites.has(favKey(m));
            return (
              <Pressable
                accessibilityLabel={`Market ${m.symbol}`}
                onLongPress={() => toggleFavorite(favKey(m))}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#F1F1F4' }]}
              >
                <MarketLogo m={m} />
                <View style={styles.rowLeft}>
                  <View style={styles.symbolLine}>
                    <Text style={[styles.symbol, { color: theme.ink }]} numberOfLines={1}>{m.symbol}</Text>
                    <View style={[styles.levPill, { backgroundColor: leverageBg }]}>
                      <Text style={[styles.levText, { color: muted }]}>{m.leverage}x</Text>
                    </View>
                  </View>
                  <Text style={[styles.vol, { color: muted }]}>{m.volume}</Text>
                </View>
                <Sparkline data={perpSpark(`${item.section}:${m.symbol}`, m.change24h)} width={90} height={44} color={col} strokeWidth={1.6} fill="flat" sharp id={`s-${item.key}`} />
                <View style={styles.rowRight}>
                  <Text style={[styles.price, { color: theme.ink }]}>{formatPerpPrice(m.price)}</Text>
                  <Text style={[styles.change, { color: col }]}>{formatChange(m.change24h)}</Text>
                </View>
                <Pressable
                  accessibilityLabel={fav ? `Unfavorite ${m.symbol}` : `Favorite ${m.symbol}`}
                  hitSlop={8}
                  onPress={() => toggleFavorite(favKey(m))}
                  style={styles.favBtn}
                >
                  <StarIcon size={18} color={fav ? '#F4B728' : muted} filled={fav} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      {/* bottom search bar */}
      <View style={[styles.bar, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
        <View style={[styles.field, { backgroundColor: chipBg }]}>
          <SearchIcon size={22} color={muted} />
          <TextInput
            accessibilityLabel="Search market"
            value={query}
            onChangeText={setQuery}
            placeholder="Search market"
            placeholderTextColor={muted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, { color: theme.ink }]}
          />
        </View>
        <Pressable
          accessibilityLabel={query ? 'Clear search' : 'Close search'}
          onPress={onX}
          style={[styles.xBtn, { backgroundColor: chipBg }]}
        >
          <CloseIcon size={22} color={theme.ink} />
        </Pressable>
      </View>

      {/* pickers */}
      <AppModal visible={picker !== null} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.dim} onPress={() => setPicker(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: dark ? '#12141F' : '#FFFFFF', paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.grab, { backgroundColor: dark ? '#3A4060' : '#C9C9D1' }]} />
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>{picker === 'provider' ? 'Providers' : 'Sort by'}</Text>
            {picker === 'provider' ? (
              (['all', 'hyperliquid', 'aster'] as ProviderFilter[]).map((p) => (
                <Pressable key={p} accessibilityLabel={`Provider ${p}`} style={styles.opt} onPress={() => { setProvider(p); setPicker(null); }}>
                  {p === 'hyperliquid' ? <HyperliquidTile size={30} /> : p === 'aster' ? <AsterTile size={30} /> : (
                    <View style={styles.marksBig}><HyperliquidTile size={26} /><View style={{ marginLeft: -8 }}><AsterTile size={26} /></View></View>
                  )}
                  <Text style={[styles.optText, { color: theme.ink }]}>{p === 'all' ? 'All providers' : p === 'hyperliquid' ? 'Hyperliquid' : 'Aster'}</Text>
                  {provider === p ? <CheckIcon size={20} color={VIOLET_DEEP} /> : null}
                </Pressable>
              ))
            ) : (
              SORT_OPTIONS.map((o) => (
                <Pressable
                  key={o.key}
                  accessibilityLabel={`Sort ${o.label}`}
                  style={styles.opt}
                  onPress={() => {
                    // same option again flips direction; a new option starts at its natural direction
                    if (o.key === sort) setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
                    else { setSort(o.key); setDir(defaultDir(o.key)); }
                    setPicker(null);
                  }}
                >
                  <Text style={[styles.optText, { color: theme.ink, marginLeft: 0 }]}>{o.label}</Text>
                  {sort === o.key ? <SortArrowIcon size={18} color={VIOLET_DEEP} up={dir === 'asc'} /> : null}
                </Pressable>
              ))
            )}
          </Pressable>
        </Pressable>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { paddingHorizontal: 16, alignItems: 'center', gap: 6, paddingBottom: 10 },
  tab: { height: 40, minWidth: 44, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  filters: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 6 },
  chip: { height: 34, borderRadius: 17, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600' },
  marks: { flexDirection: 'row', alignItems: 'center' },
  marksBig: { flexDirection: 'row', alignItems: 'center', width: 30 },
  center: { flex: 1, alignItems: 'center', paddingTop: 140 },
  empty: { fontSize: 15, fontFamily: 'Inter-500', fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 76 },
  logo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowLeft: { flex: 1, marginLeft: 12 },
  symbolLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  symbol: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700', maxWidth: 110 },
  levPill: { paddingHorizontal: 7, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  levText: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },
  vol: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 3 },
  rowRight: { alignItems: 'flex-end', minWidth: 96, marginLeft: 6 },
  price: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
  change: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 3 },
  favBtn: { marginLeft: 8, width: 24, alignItems: 'center' },
  bar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  field: { flex: 1, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10 },
  input: { flex: 1, fontSize: 17, fontFamily: 'Inter-500', paddingVertical: 0 },
  xBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  opt: { flexDirection: 'row', alignItems: 'center', height: 56, gap: 12 },
  optText: { flex: 1, fontSize: 17, fontFamily: 'Inter-600', fontWeight: '600', marginLeft: 0 },
});
