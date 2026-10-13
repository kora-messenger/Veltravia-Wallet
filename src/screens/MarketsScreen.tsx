/**
 * Veltravia Wallet — Markets tab (Pro variant).
 *
 * Global stats strip, category chips (All / Gainers / Losers / Favorites),
 * top-movers carousel, and a live-style coin list with sparklines and
 * favorite stars. Data comes from marketData (Phase 2 swaps in the
 * backend prices feed). The floating bottom bar is untouched.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import Sparkline from '../components/Sparkline';
import { SearchIcon } from '../components/icons';
import { BtcGlyph, BnbGlyph, EthGlyph, SolGlyph, TrxGlyph, DollarGlyph } from '../wallets/WalletGlyphs';
import { useTheme } from '../theme/ThemeProvider';
import { GLOBAL_STATS, MARKET_COINS, MarketCoin } from '../services/marketData';

const GLYPHS: Record<MarketCoin['glyph'], React.ComponentType<{ size?: number; color?: string }>> = {
  btc: BtcGlyph, bnb: BnbGlyph, eth: EthGlyph, sol: SolGlyph, trx: TrxGlyph, dollar: DollarGlyph,
};

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
  const [chip, setChip] = useState<Chip>('all');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['bitcoin', 'ethereum']));

  const movers = useMemo(
    () => [...MARKET_COINS].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 5),
    []
  );

  const list = useMemo(() => {
    let out = MARKET_COINS;
    if (chip === 'gainers') out = out.filter((c) => c.change24h > 0).sort((a, b) => b.change24h - a.change24h);
    else if (chip === 'losers') out = out.filter((c) => c.change24h < 0).sort((a, b) => a.change24h - b.change24h);
    else if (chip === 'favorites') out = out.filter((c) => favorites.has(c.id));
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
    return out;
  }, [chip, query, favorites]);

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
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.ink }]}>Markets</Text>

        {/* inline search */}
        <View style={[styles.search, { backgroundColor: theme.surfaceAlt }]}>
          <SearchIcon size={18} color={theme.inkMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.ink }]}
            placeholder="Search coin or symbol"
            placeholderTextColor={theme.inkMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {/* global stats strip */}
        <View style={styles.statsRow}>
          {[
            { label: 'Market Cap', value: fmtCompact(GLOBAL_STATS.totalMarketCap) },
            { label: '24h Volume', value: fmtCompact(GLOBAL_STATS.volume24h) },
            { label: 'BTC Dominance', value: GLOBAL_STATS.btcDominance.toFixed(1) + '%' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={[styles.statLabel, { color: theme.inkMuted }]}>{s.label}</Text>
              <Text style={[styles.statValue, { color: theme.ink }]}>{s.value}</Text>
            </View>
          ))}
        </View>

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

        {/* top movers carousel */}
        <Text style={[styles.section, { color: theme.ink }]}>Top Movers</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moversRow}>
          {movers.map((c) => {
            const Glyph = GLYPHS[c.glyph];
            const up = c.change24h >= 0;
            return (
              <View key={c.id} style={[styles.moverCard, { backgroundColor: theme.surfaceAlt }]}>
                <View style={styles.moverTop}>
                  <View style={[styles.glyphCircle, { backgroundColor: c.color }]}>
                    <Glyph size={18} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.moverSymbol, { color: theme.ink }]}>{c.symbol}</Text>
                  <ChangeChip v={c.change24h} />
                </View>
                <Text style={[styles.moverPrice, { color: theme.ink }]}>{fmtUsd(c.priceUsd)}</Text>
                <Sparkline data={c.history} width={130} height={34} color={up ? theme.positive : theme.negative} strokeWidth={1.6} id={'mv-' + c.id} />
              </View>
            );
          })}
        </ScrollView>

        {/* coin list */}
        <Text style={[styles.section, { color: theme.ink }]}>
          {chip === 'all' ? 'All Coins' : chip === 'favorites' ? 'Favorites' : chip === 'gainers' ? 'Top Gainers' : 'Top Losers'}
        </Text>
        {list.map((c) => {
          const Glyph = GLYPHS[c.glyph];
          const up = c.change24h >= 0;
          const fav = favorites.has(c.id);
          return (
            <View key={c.id} style={[styles.row, { borderBottomColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(6,14,44,0.06)' }]}>
              <View style={[styles.glyphCircle, { backgroundColor: c.color }]}>
                <Glyph size={18} color="#FFFFFF" />
              </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 130 },
  title: { fontSize: 28, fontFamily: 'Inter-700', fontWeight: '800', marginBottom: 14, lineHeight: 39 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, paddingHorizontal: 14, height: 44, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter-500', fontWeight: '500', padding: 0 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' },
  statLabel: { fontSize: 11, fontFamily: 'Inter-600', fontWeight: '600' },
  statValue: { fontSize: 14, fontFamily: 'Inter-700', fontWeight: '700', marginTop: 3 },
  chipsRow: { flexDirection: 'row', gap: 8, paddingBottom: 16 },
  chipBtn: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  chipLabel: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
  section: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700', marginBottom: 12 },
  moversRow: { flexDirection: 'row', gap: 12, paddingBottom: 20 },
  moverCard: { borderRadius: 16, padding: 14, width: 158, gap: 8 },
  moverTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moverSymbol: { fontSize: 13, fontFamily: 'Inter-700', fontWeight: '700', flex: 1 },
  moverPrice: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
  glyphCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
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
