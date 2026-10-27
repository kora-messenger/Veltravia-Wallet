/**
 * Veltravia Wallet — Discover tab (Trust parity, from the screen recording).
 *
 *  - ONE screen, two pages (Tokens | dApps) under a "Trending" header with a
 *    capsule selector. The pages swipe horizontally and the capsule follows.
 *  - "Recents" sits ABOVE the pager, so it never moves when the user pages
 *    between Tokens and dApps. It is hidden until the user taps a coin/dApp,
 *    and "Clear all" empties (and hides) it.
 *  - Bottom search bar: tab counter, field, Paste pill (explicit-tap clipboard
 *    read) / clear button, and an X that dismisses search.
 *  - Searching shows the network loading state — three shimmer skeleton rows
 *    (decoded from the recording: 101px rows on a 169px pitch) — until the
 *    query resolves, then All / Tokens / Predictions / dApps results.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput, Animated, Easing, Platform,
  Keyboard, Linking, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { SkeletonBlock } from '../components/Skeleton';
import { CloseIcon, SearchIcon } from '../components/icons';
import { pasteFromClipboard } from '../core/clipboard';
import { showToast } from '../components/Toast';
import {
  TRENDING_TOKENS, DAPPS, CHAIN_LABEL, CHAIN_COLOR, searchDiscover, fmtPrice, fmtVol, fmtChange,
  type TrendingToken, type Dapp, type Prediction, type DiscoverSearchResult,
} from '../services/discoverData';
import { addRecent, clearRecents, useRecents, type RecentItem } from '../services/discoverRecents';

type Page = 'tokens' | 'dapps';
type Filter = 'all' | 'tokens' | 'predictions' | 'dapps';


/* ---- small visuals -------------------------------------------------------- */

function initials(name: string): string {
  const w = name.replace(/\(.*?\)/g, '').trim().split(/\s+/);
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}

/** Avatar disc + chain badge (logo art arrives with the live feed). */
function TokenAvatar({ t, size = 40 }: { t: Pick<TrendingToken, 'name' | 'color' | 'chain'>; size?: number }) {
  const badge = Math.round(size * 0.4);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.color }]}>
        <Text style={[styles.discText, { fontSize: size * 0.32 }]}>{initials(t.name)}</Text>
      </View>
      <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge * 0.3, backgroundColor: CHAIN_COLOR[t.chain] }]} />
    </View>
  );
}

function DappAvatar({ d, size = 40 }: { d: Pick<Dapp, 'name' | 'color'>; size?: number }) {
  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius: size * 0.26, backgroundColor: d.color }]}>
      <Text style={[styles.discText, { fontSize: size * 0.34 }]}>{initials(d.name)}</Text>
    </View>
  );
}

const OpenArrow = ({ color }: { color: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M7 17L17 7M9 7h8v8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ClearCircle = ({ color }: { color: string }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill={color} />
    <Path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

/* ---- loading state: 3 skeleton rows (Trust search-in-flight) ------------------ */

function SearchSkeleton() {
  return (
    <View style={styles.skelWrap} accessibilityLabel="Searching">
      {[0, 1, 2].map((i) => (
        <SkeletonBlock key={i} style={styles.skelRow} />
      ))}
    </View>
  );
}

/* ---- rows ---------------------------------------------------------------------- */

function TokenRow({ t, onPress }: { t: TrendingToken; onPress: () => void }) {
  const { theme } = useTheme();
  const up = t.change24h >= 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <TokenAvatar t={t} />
      <View style={styles.rowMid}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.ink }]}>{t.name}</Text>
        <Text numberOfLines={1} style={[styles.rowSub, { color: theme.inkMuted }]}>
          {t.symbol} · {fmtVol(t.volume24h)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowPrice, { color: theme.ink }]}>{fmtPrice(t.priceUsd)}</Text>
        <Text style={[styles.rowChange, { color: up ? theme.positive : theme.negative }]}>{fmtChange(t.change24h)}</Text>
      </View>
    </Pressable>
  );
}

function DappRow({ d, onPress }: { d: Dapp; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <DappAvatar d={d} />
      <View style={styles.rowMid}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.ink }]}>{d.name}</Text>
        <Text numberOfLines={1} style={[styles.rowSub, { color: theme.inkMuted }]}>{d.category}</Text>
      </View>
      <OpenArrow color={theme.inkMuted} />
    </Pressable>
  );
}

function PredictionRow({ p }: { p: Prediction }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.predBox, { backgroundColor: theme.surfaceAlt }]} />
      <View style={styles.rowMid}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.ink }]}>{p.title}</Text>
        <Text style={[styles.rowSub, { color: theme.inkMuted }]}>${p.volume.toFixed(2)} Vol</Text>
      </View>
    </View>
  );
}

/* ---- Recents strip (above the pager; survives page switches) ------------------- */

function RecentsStrip({ recents, onTap }: { recents: RecentItem[]; onTap: (r: RecentItem) => void }) {
  const { theme } = useTheme();
  if (recents.length === 0) return null; // hidden until the user taps something
  return (
    <View style={styles.recentsWrap}>
      <View style={styles.recentsHead}>
        <Text style={[styles.sectionTitle, { color: theme.ink }]}>Recents</Text>
        <Pressable hitSlop={10} onPress={clearRecents}>
          <Text style={[styles.clearAll, { color: theme.inkMuted }]}>Clear all</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentsScroll} contentContainerStyle={styles.recentsRow}>
        {recents.map((r) => (
          <Pressable
            key={r.kind + r.id}
            onPress={() => onTap(r)}
            style={[styles.recentPill, { backgroundColor: theme.surfaceAlt }]}
          >
            <View style={[styles.recentDot, { backgroundColor: r.color }]}>
              <Text style={styles.recentDotText}>{initials(r.label)}</Text>
            </View>
            <View>
              <Text numberOfLines={1} style={[styles.recentName, { color: theme.ink }]}>{r.label}</Text>
              <Text style={[styles.recentCap, { color: theme.inkMuted }]}>{r.caption}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* ---- screen ------------------------------------------------------------------------ */

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const recents = useRecents();
  const navigation = useNavigation<any>();

  const [page, setPage] = useState<Page>('tokens');
  const pagerRef = useRef<{ scrollTo: (o: { x: number; animated?: boolean }) => void } | null>(null);

  // search
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiscoverSearchResult | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const inputRef = useRef<{ focus: () => void } | null>(null);

  // keyboard: lift the search bar above it (edge-to-edge Android ignores resize)
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, (e) => setKb(e.endCoordinates?.height ?? 0));
    const b = Keyboard.addListener(hide, () => setKb(0));
    return () => { a.remove(); b.remove(); };
  }, []);

  // Debounced search with cancellation: the skeleton shows from the first
  // keystroke until THAT query resolves; a newer keystroke supersedes it.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setLoading(false);
      setResults(null);
      return;
    }
    setLoading(true);
    const signal = { cancelled: false };
    const t = setTimeout(() => {
      searchDiscover(q, signal)
        .then((r) => {
          if (signal.cancelled) return;
          setResults(r);
          setLoading(false);
        })
        .catch(() => {
          /* superseded by a newer query: that one owns the loading state */
        });
    }, 250);
    return () => {
      signal.cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const goPage = useCallback((p: Page) => {
    setPage(p);
    pagerRef.current?.scrollTo({ x: p === 'tokens' ? 0 : width, animated: true });
  }, [width]);

  const onPagerEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(e.nativeEvent.contentOffset.x >= width / 2 ? 'dapps' : 'tokens');
  };

  const openToken = useCallback((t: TrendingToken) => {
    addRecent({ id: t.id, kind: 'token', label: t.symbol, caption: 'Token', color: t.color });
    showToast(`${t.name} details arrive with live market data`, { kind: 'info' });
  }, []);

  const openDapp = useCallback((d: Dapp) => {
    addRecent({ id: d.id, kind: 'dapp', label: d.name, caption: 'dApp', color: d.color });
    Linking.openURL(d.url).catch(() => showToast("Couldn't open that dApp. Try again later.", { kind: 'error' }));
  }, []);

  const onRecentTap = useCallback((r: RecentItem) => {
    if (r.kind === 'dapp') {
      const d = DAPPS.find((x) => x.id === r.id);
      if (d) openDapp(d);
    } else {
      const t = TRENDING_TOKENS.find((x) => x.id === r.id);
      if (t) openToken(t);
    }
  }, [openDapp, openToken]);

  // X leaves Discover and returns to Home (full-screen screen, Trust parity).
  const closeDiscover = () => {
    Keyboard.dismiss();
    setQuery('');
    setSearchOpen(false);
    setFilter('all');
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs', { screen: 'Home' });
  };

  const onPaste = async () => {
    const t = (await pasteFromClipboard()).trim();
    if (!t) {
      showToast('Clipboard is empty', { kind: 'info' });
      return;
    }
    setSearchOpen(true);
    setQuery(t.slice(0, 80));
  };

  const searching = searchOpen && query.trim().length > 0;
  const barBottom = kb > 0 ? kb + 8 : Math.max(insets.bottom, 12) + 8;
  const listBottom = barBottom + 44 + 16; // clear the docked search bar

  /* search results body */
  const renderResults = () => {
    if (loading || !results) return <SearchSkeleton />;
    const showTokens = (filter === 'all' || filter === 'tokens') && results.tokens.length > 0;
    const showPreds = (filter === 'all' || filter === 'predictions') && results.predictions.length > 0;
    const showDapps = (filter === 'all' || filter === 'dapps') && results.dapps.length > 0;
    if (!showTokens && !showPreds && !showDapps) {
      return (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.ink }]}>No results</Text>
          <Text style={[styles.emptySub, { color: theme.inkMuted }]}>
            Nothing matched “{query.trim()}”. Check the spelling or try another name.
          </Text>
        </View>
      );
    }
    return (
      <>
        {showTokens && (
          <>
            <Text style={[styles.groupTitle, { color: theme.ink }]}>Tokens</Text>
            {results.tokens.map((t) => <TokenRow key={t.id} t={t} onPress={() => openToken(t)} />)}
          </>
        )}
        {showPreds && (
          <>
            <Text style={[styles.groupTitle, { color: theme.ink }]}>Predictions</Text>
            {results.predictions.map((p) => <PredictionRow key={p.id} p={p} />)}
          </>
        )}
        {showDapps && (
          <>
            <Text style={[styles.groupTitle, { color: theme.ink }]}>dApps</Text>
            {results.dapps.map((d) => <DappRow key={d.id} d={d} onPress={() => openDapp(d)} />)}
          </>
        )}
      </>
    );
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'tokens', label: 'Tokens' },
    { key: 'predictions', label: 'Predictions' },
    { key: 'dapps', label: 'dApps' },
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      {searching ? (
        /* ---- search mode ---- */
        <View style={styles.flex}>
          <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
            {filters.map((f) => {
              const on = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[styles.filterPill, on && { backgroundColor: theme.surfaceAlt }]}
                >
                  <Text style={[styles.filterText, { color: on ? theme.ink : theme.inkMuted }]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          </View>
          <ScrollView
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: listBottom }}
          >
            {renderResults()}
          </ScrollView>
        </View>
      ) : (
        /* ---- browse mode: Recents (fixed) + Trending pager ---- */
        <View style={styles.flex}>
          <RecentsStrip recents={recents} onTap={onRecentTap} />

          <View style={styles.trendHead}>
            <Text style={[styles.sectionTitle, { color: theme.ink }]}>Trending</Text>
            <View style={[styles.capsule, { backgroundColor: theme.surfaceAlt }]}>
              {(['tokens', 'dapps'] as Page[]).map((p) => {
                const on = page === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => goPage(p)}
                    style={[styles.capsuleBtn, on && { backgroundColor: theme.background }]}
                  >
                    <Text style={[styles.capsuleText, { color: on ? theme.ink : theme.inkMuted }]}>
                      {p === 'tokens' ? 'Tokens' : 'dApps'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ScrollView
            ref={pagerRef as any}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPagerEnd}
            style={styles.flex}
          >
            <ScrollView style={{ width }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: listBottom }}>
              {TRENDING_TOKENS.map((t) => <TokenRow key={t.id} t={t} onPress={() => openToken(t)} />)}
            </ScrollView>
            <ScrollView style={{ width }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: listBottom }}>
              {DAPPS.map((d) => <DappRow key={d.id} d={d} onPress={() => openDapp(d)} />)}
            </ScrollView>
          </ScrollView>
        </View>
      )}

      {/* ---- bottom search bar ---- */}
      <View style={[styles.barWrap, { bottom: barBottom }]} pointerEvents="box-none">
        <View style={[styles.counter, { backgroundColor: theme.surfaceAlt }]}>
          <View style={[styles.counterBox, { borderColor: theme.ink }]}>
            <Text style={[styles.counterText, { color: theme.ink }]}>0</Text>
          </View>
        </View>
        <View style={[styles.field, { backgroundColor: theme.surfaceAlt }]}>
          <SearchIcon size={18} color={theme.inkMuted} />
          <TextInput
            ref={inputRef as any}
            value={query}
            onChangeText={(t) => { setSearchOpen(true); setQuery(t); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Tokens, dApps"
            placeholderTextColor={theme.inkMuted}
            selectionColor={theme.brand}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={[styles.input, { color: theme.ink }]}
          />
          {query.length > 0 ? (
            <Pressable hitSlop={10} onPress={() => { setQuery(''); inputRef.current?.focus(); }} accessibilityLabel="Clear search">
              <ClearCircle color={theme.inkMuted} />
            </Pressable>
          ) : (
            <Pressable onPress={onPaste} style={[styles.pasteBtn, { backgroundColor: theme.background }]}>
              <Text style={[styles.pasteText, { color: theme.ink }]}>Paste</Text>
            </Pressable>
          )}
        </View>
        <Pressable onPress={closeDiscover} style={[styles.closeBtn, { backgroundColor: theme.surfaceAlt }]} accessibilityLabel="Close search">
          <CloseIcon size={22} color={theme.ink} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  sectionTitle: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  groupTitle: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700', marginTop: 18, marginBottom: 6 },

  /* recents */
  recentsWrap: { paddingTop: 20 },
  recentsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  clearAll: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500' },
  recentsScroll: { flexGrow: 0 }, // never stretch to fill the column
  recentsRow: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  recentPill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 16, minWidth: 124 },
  recentDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  recentDotText: { color: '#fff', fontSize: 11, fontFamily: 'Inter-700', fontWeight: '700' },
  recentName: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600', maxWidth: 84 },
  recentCap: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500' },

  /* trending header + capsule */
  trendHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 },
  capsule: { flexDirection: 'row', borderRadius: 20, padding: 3 },
  capsuleBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 17 },
  capsuleText: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600' },

  /* rows */
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowMid: { flex: 1 },
  rowTitle: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  rowSub: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowPrice: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  rowChange: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 2 },

  disc: { alignItems: 'center', justifyContent: 'center' },
  discText: { color: '#fff', fontFamily: 'Inter-700', fontWeight: '700' },
  badge: { position: 'absolute', right: -2, bottom: -2, borderWidth: 2, borderColor: '#fff' },
  predBox: { width: 40, height: 40, borderRadius: 8 },

  /* search filters + states */
  // Fixed-height strip: without this the horizontal ScrollView stretches to fill the
  // column and every pill becomes a tall lavender block (seen in the recording).
  filterBar: { height: 52 },
  filterScroll: { flexGrow: 0, height: 52 },
  filterRow: { paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  filterPill: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600' },
  skelWrap: { paddingTop: 16, gap: 12 },
  skelRow: { height: 64, borderRadius: 14 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500', textAlign: 'center' },

  /* bottom search bar */
  barWrap: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  counter: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  counterBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  counterText: { fontSize: 12, fontFamily: 'Inter-700', fontWeight: '700' },
  field: { flex: 1, height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter-500', paddingVertical: 0 },
  pasteBtn: { height: 32, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pasteText: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600' },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
