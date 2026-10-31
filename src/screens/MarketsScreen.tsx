/**
 * Veltravia Wallet — Markets tab (Pro variant).
 *
 * Global stats strip, category chips (All / Gainers / Losers / Favorites),
 * top-movers carousel, and a live-style coin list with sparklines and
 * favorite stars. Data comes from marketData (Phase 2 swaps in the
 * backend prices feed). The floating bottom bar is untouched.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import Sparkline from '../components/Sparkline';
import CoinLogo from '../components/CoinLogo';
import { CloseIcon, SearchIcon } from '../components/icons';
import { useTheme } from '../theme/ThemeProvider';
import { MARKET_COINS } from '../services/marketData';
import { refreshPrices, refreshFailureMessage } from '../services/livePrices';
import { useRefresh } from '../hooks/useRefresh';
import { usePullToReload } from '../hooks/usePullToReload';
import { MarketsSkeleton } from '../components/Skeleton';
import { showToast } from '../components/Toast';

const MOVER_W = 132;

const fmtUsd = (v: number) =>
  '$' + (v >= 1
    ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toFixed(4));

const fmtCompact = (v: number) => {
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  return '$' + (v / 1e6).toFixed(0) + 'M';
};

type Chip = 'all' | 'gainers' | 'losers' | 'favorites';

export default function MarketsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = theme.mode === 'dark';
  const circleBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(60,64,90,0.08)';
  const [chip, setChip] = useState<Chip>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['bitcoin', 'ethereum']));
  // Pull to refresh asks our backend for prices; until it answers the bundled
  // snapshot is what you see, and a failure says so instead of pretending.
  const [live, setLive] = useState<Record<string, { priceUsd: number; change24h: number }>>({});
  const coins = useMemo(
    () => MARKET_COINS.map((c) => {
      const q = live[c.symbol.toUpperCase()];
      return q ? { ...c, priceUsd: q.priceUsd, change24h: q.change24h } : c;
    }),
    [live],
  );
  const onRefreshWork = useCallback(async () => {
    const res = await refreshPrices();
    if (res.ok) {
      const next: Record<string, { priceUsd: number; change24h: number }> = {};
      for (const q of res.quotes) next[q.symbol] = { priceUsd: q.priceUsd, change24h: q.change24h };
      setLive(next);
    } else {
      showToast(refreshFailureMessage(res.reason));
    }
  }, []);
  const { refreshing, onRefresh } = useRefresh(onRefreshWork);
  // Pull-down reloads through the shimmer skeleton; no native spinner.
  const pull = usePullToReload(onRefresh, !refreshing);

  const movers = useMemo(
    () => [...coins].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 5),
    [coins]
  );

  const list = useMemo(() => {
    let out = coins;
    if (chip === 'gainers') out = out.filter((c) => c.change24h > 0).sort((a, b) => b.change24h - a.change24h);
    else if (chip === 'losers') out = out.filter((c) => c.change24h < 0).sort((a, b) => a.change24h - b.change24h);
    else if (chip === 'favorites') out = out.filter((c) => favorites.has(c.id));
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
    return out;
  }, [chip, query, favorites, coins]);

  const toggleFav = (id: string) =>
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chips: Array<{ key: Chip; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'gainers', label: 'Gainers' },
    { key: 'losers', label: 'Losers' },
    { key: 'favorites', label: 'Favorites' },
  ];

  const ChangeChip = ({ v, big }: { v: number; big?: boolean }) => {
    const up = v >= 0;
    const c = up ? theme.positive : theme.negative;
    return (
      <View style={[styles.chip, { backgroundColor: c + '1F' }]}>
        <Text style={[styles.chipText, { color: c }, big && { fontSize: 15 }]}>
          {up ? '+' : ''}{v.toFixed(2)}%
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* pinned header: centered title, search circle on the right */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {searching ? (
          <View style={[styles.searchBar, { backgroundColor: circleBg }]}>
            <SearchIcon size={18} color={theme.inkMuted} />
            <TextInput
              autoFocus
              style={[styles.searchInput, { color: theme.ink }]}
              placeholder="Search coin or symbol"
              placeholderTextColor={theme.inkMuted}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            <Pressable
              hitSlop={10}
              onPress={() => { setQuery(''); setSearching(false); }}
              accessibilityLabel="Close search"
            >
              <CloseIcon size={20} color={theme.inkMuted} />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.titleWrap, { top: insets.top + 8 }]} pointerEvents="none">
              <Text style={[styles.title, { color: theme.ink }]}>Markets</Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={() => setSearching(true)}
              accessibilityLabel="Search coins"
              style={[styles.headerBtn, { backgroundColor: circleBg }]}
            >
              <SearchIcon size={22} color={theme.ink} />
            </Pressable>
          </>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...pull.bind}
        onScroll={pull.onScroll}
      >
        {refreshing ? <MarketsSkeleton /> : (
        <>
        {/* top movers carousel */}
        <Text style={[styles.section, { color: theme.ink }]}>Top Movers</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moversRow}>
          {movers.map((c) => {
            const up = c.change24h >= 0;
            const tone = up ? theme.positive : theme.negative;
            return (
              <View key={c.id} style={[styles.moverCard, { backgroundColor: theme.surfaceAlt }]}>
                <View style={styles.moverHead}>
                  <Text numberOfLines={1} style={[styles.moverName, { color: theme.inkMuted }]}>
                    {c.name}
                  </Text>
                  <CoinLogo symbol={c.symbol} color={c.color} size={24} />
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.moverPrice, { color: theme.ink }]}>
                  {fmtUsd(c.priceUsd)}
                </Text>
                <Text style={[styles.moverChange, { color: tone }]}>
                  {up ? '+' : ''}{c.change24h.toFixed(2)}%
                </Text>
                <View style={styles.moverChart}>
                  <Sparkline
                    data={c.history}
                    width={MOVER_W - 24}
                    height={40}
                    color={tone}
                    strokeWidth={2}
                    fill="flat"
                    sharp
                    id={'mv-' + c.id}
                  />
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {chips.map((c) => {
            const active = chip === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setChip(c.key)}
                style={[
                  styles.chipBtn,
                  {
                    backgroundColor: active ? theme.brand : theme.surfaceAlt,
                    borderColor: active ? theme.brand : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.chipLabel, { color: active ? '#FFFFFF' : theme.inkMuted }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* coin list */}
        <Text style={[styles.section, { color: theme.ink }]}>
          {chip === 'all' ? 'All Coins' : chip === 'favorites' ? 'Favorites' : chip === 'gainers' ? 'Top Gainers' : 'Top Losers'}
        </Text>
        {list.map((c) => {
          const up = c.change24h >= 0;
          const fav = favorites.has(c.id);
          return (
            <View key={c.id} style={[styles.row, { borderBottomColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(6,14,44,0.06)' }]}>
              <CoinLogo symbol={c.symbol} color={c.color} size={34} />
              <View style={styles.rowMid}>
                <Text style={[styles.rowName, { color: theme.ink }]}>{c.name}</Text>
                <Text style={[styles.rowSub, { color: theme.inkMuted }]}>
                  {c.symbol} · {fmtCompact(c.marketCap)}
                </Text>
              </View>
              <Sparkline data={c.history} width={64} height={28} color={up ? theme.positive : theme.negative} strokeWidth={1.5} id={'ls-' + c.id} />
              <View style={styles.rowRight}>
                <Text style={[styles.rowPrice, { color: theme.ink }]}>{fmtUsd(c.priceUsd)}</Text>
                <ChangeChip v={c.change24h} />
              </View>
              <Pressable hitSlop={10} onPress={() => toggleFav(c.id)} style={styles.favBtn}>
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path
                    d="M12 3.6l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.8l5.9-.9z"
                    fill={fav ? theme.brand : 'none'}
                    stroke={fav ? theme.brand : theme.inkMuted}
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            </View>
          );
        })}
        {list.length === 0 && (
          <Text style={[styles.empty, { color: theme.inkMuted }]}>
            {chip === 'favorites' ? 'Star coins to build your favorites.' : 'No coins match your search.'}
          </Text>
        )}
        </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 130 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 10, minHeight: 36 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { position: 'absolute', left: 0, right: 0, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700', letterSpacing: -0.3 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, paddingHorizontal: 12, height: 36 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter-500', fontWeight: '500', padding: 0 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingBottom: 16 },
  chipBtn: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  chipLabel: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
  section: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700', marginBottom: 12 },
  moversRow: { flexDirection: 'row', gap: 10, paddingBottom: 18 },
  moverCard: { borderRadius: 16, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 0, width: MOVER_W, overflow: 'hidden' },
  moverHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  moverName: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600', flex: 1, marginRight: 8 },
  moverPrice: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700', marginTop: 8 },
  moverChange: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 2 },
  moverChart: { marginTop: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMid: { flex: 1 },
  rowName: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  rowSub: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', minWidth: 82 },
  rowPrice: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700', marginBottom: 4 },
  chip: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-end' },
  chipText: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },
  favBtn: { paddingLeft: 2 },
  empty: { textAlign: 'center', fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 24 },
});
