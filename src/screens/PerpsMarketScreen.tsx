/**
 * Veltravia Wallet — Perps market page (Trust parity).
 *
 * Opened by tapping a market row (Perps home, Search market, Watchlist).
 * Header: back, star (favorite), bell, history. Then symbol + leverage chip,
 * name, price and 24h change, the chart, timeframe chips, About, Stats, and
 * the Long / Short buttons with "Provided by <venue>".
 *
 * The star is the ONE place favorites are made on the market itself: starring
 * adds the market to the star tab on Search market AND to the Watchlist section
 * on the Perps home; un-starring removes it (and the Watchlist disappears when
 * it was the last one). Opening a market also adds it to Recents.
 *
 * The chart is a deterministic placeholder line until api.veltraviawallet.com
 * serves candles; trading buttons arrive with the order flow.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import Sparkline from '../components/Sparkline';
import { HyperliquidTile, AsterTile } from '../components/PerpsVenueMarks';
import { showToast } from '../components/Toast';
import {
  BackIcon, StarIcon, BellIcon, HistoryIcon, ChevronDownIcon, ChevronRight,
  ArrowUpRightTx, ArrowDownRightIcon, COIN_ICONS,
} from '../components/icons';
import { PERP_SECTIONS, formatPerpPrice, formatChange, perpSpark, type PerpMarket } from '../services/perpsMarkets';
import { usePerpsFavorites, toggleFavorite, loadPerpsFavorites } from '../services/perpsFavorites';
import { addPerpsRecent } from '../services/perpsRecents';
import { favKey } from '../services/perpsSearch';
import type { PerpsVenue } from '../services/perpsVenues';

const GREEN = '#158444';
const RED = '#D63232';
const TIMEFRAMES = ['1H', '1D', '1W', '1M', '1Y', 'YTD'] as const;

export function findMarket(venue: PerpsVenue, symbol: string): PerpMarket | undefined {
  for (const s of PERP_SECTIONS) {
    const m = s.markets.find((x) => x.symbol === symbol && (x.venue ?? 'hyperliquid') === venue);
    if (m) return m;
  }
  return undefined;
}

function Logo({ m }: { m: PerpMarket }) {
  const Coin = COIN_ICONS[m.symbol];
  if (Coin) return <Coin size={48} />;
  const tile = m.tile ?? { bg: '#E9EAEE', fg: '#555A66', text: m.symbol[0] };
  return (
    <View style={[styles.logo, { backgroundColor: tile.bg }]}>
      <Text style={{ color: tile.fg, fontSize: tile.text.length > 2 ? 12 : 20, fontFamily: 'Inter-700', fontWeight: '700' }}>{tile.text}</Text>
    </View>
  );
}

export default function PerpsMarketScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const venue: PerpsVenue = route.params?.venue ?? 'hyperliquid';
  const symbol: string = route.params?.symbol ?? 'BTC';
  const market = findMarket(venue, symbol);
  const favorites = usePerpsFavorites();
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>('1D');

  useEffect(() => {
    loadPerpsFavorites();
    if (market) addPerpsRecent({ venue, symbol });
  }, [venue, symbol, market]);

  const spark = useMemo(
    () => (market ? perpSpark(`detail:${tf}:${symbol}`, market.change24h, 60) : []),
    [market, tf, symbol],
  );

  const chipBg = dark ? '#1D2133' : '#EEEEF0';
  const muted = theme.inkMuted;

  if (!market) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 8, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: muted, fontSize: 15 }}>Market not found</Text>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 16 }}><Text style={{ color: theme.brand, fontWeight: '600' }}>Back</Text></Pressable>
      </View>
    );
  }

  const key = favKey(market);
  const fav = favorites.has(key);
  const up = market.change24h >= 0;
  const col = up ? GREEN : RED;
  const delta = (market.price * market.change24h) / (100 + market.change24h);
  const VenueTile = venue === 'aster' ? AsterTile : HyperliquidTile;

  const onStar = () => {
    Vibration.vibrate(10);
    toggleFavorite(key);
    showToast(fav ? 'Removed from Watchlist' : 'Added to Watchlist', { kind: 'success' });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => navigation.goBack()} style={[styles.circle, { backgroundColor: chipBg }]}>
          <BackIcon size={22} color={theme.ink} />
        </Pressable>
        <View style={styles.headRight}>
          <Pressable accessibilityLabel={fav ? 'Remove from favorites' : 'Add to favorites'} onPress={onStar} style={[styles.circle, { backgroundColor: chipBg }]}>
            <StarIcon size={22} color={fav ? theme.brand : theme.ink} filled={fav} />
          </Pressable>
          <Pressable accessibilityLabel="Price alerts" onPress={() => showToast('Price alerts arrive with the backend feed', { kind: 'info' })} style={[styles.circle, { backgroundColor: chipBg }]}>
            <BellIcon size={22} color={theme.ink} />
          </Pressable>
          <Pressable accessibilityLabel="Market history" onPress={() => navigation.navigate('Activity')} style={[styles.circle, { backgroundColor: chipBg }]}>
            <HistoryIcon size={22} color={theme.ink} />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 170 + insets.bottom }}>
        <View style={styles.titleRow}>
          <Logo m={market} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.symLine}>
              <Text style={[styles.symbol, { color: theme.ink }]}>{market.symbol}</Text>
              <View style={[styles.levPill, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : '#EEEEF3' }]}>
                <Text style={[styles.levText, { color: muted }]}>{market.leverage}x</Text>
              </View>
              <ChevronDownIcon size={18} color={muted} />
            </View>
            <Text style={[styles.name, { color: muted }]}>{market.symbol}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.price, { color: theme.ink }]}>{formatPerpPrice(market.price)}</Text>
            <Text style={[styles.delta, { color: col }]}>
              {`${up ? '+' : '-'}${formatPerpPrice(Math.abs(delta))} (${formatChange(market.change24h).replace('+', '')})`}
            </Text>
          </View>
        </View>

        <View style={styles.chart}>
          <Sparkline data={spark} width={340} height={200} color={col} strokeWidth={2} fill="flat" id={`detail-${symbol}`} />
        </View>

        <View style={styles.tfRow}>
          {TIMEFRAMES.map((x) => (
            <Pressable
              key={x}
              accessibilityLabel={`Timeframe ${x}`}
              onPress={() => setTf(x)}
              style={[styles.tf, tf === x && { backgroundColor: chipBg }]}
            >
              <Text style={[styles.tfText, { color: tf === x ? theme.ink : muted }]}>{x}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.rule, { backgroundColor: dark ? '#222639' : '#ECECF0' }]} />
        <Pressable style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>{`About ${market.symbol}`}</Text>
          <ChevronRight size={18} color={theme.ink} />
        </Pressable>
        <Text style={[styles.about, { color: muted }]}>
          {`${market.symbol} perpetual market, up to ${market.leverage}x leverage. Detailed market information arrives with the live data feed.`}
        </Text>

        <View style={[styles.rule, { backgroundColor: dark ? '#222639' : '#ECECF0' }]} />
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Stats</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: muted }]}>24h volume</Text>
          <Text style={[styles.statValue, { color: theme.ink }]}>{market.volume.replace(' Vol', '')}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: muted }]}>Max leverage</Text>
          <Text style={[styles.statValue, { color: theme.ink }]}>{`${market.leverage}x`}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: theme.background }]}>
        <View style={styles.ls}>
          <Pressable
            accessibilityLabel="Long"
            onPress={() => showToast('Opening positions arrives with the signing bridge', { kind: 'info' })}
            style={({ pressed }) => [styles.lsBtn, { backgroundColor: GREEN, opacity: pressed ? 0.88 : 1 }]}
          >
            <Text style={styles.lsText}>Long</Text>
            <ArrowUpRightTx size={18} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
          <Pressable
            accessibilityLabel="Short"
            onPress={() => showToast('Opening positions arrives with the signing bridge', { kind: 'info' })}
            style={({ pressed }) => [styles.lsBtn, { backgroundColor: RED, opacity: pressed ? 0.88 : 1 }]}
          >
            <Text style={styles.lsText}>Short</Text>
            <ArrowDownRightIcon size={18} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        </View>
        <View style={styles.provided}>
          <Text style={[styles.providedText, { color: muted }]}>Provided by</Text>
          <VenueTile size={18} />
          <Text style={[styles.providedText, { color: theme.ink, fontWeight: '600' }]}>{venue === 'aster' ? 'Aster' : 'Hyperliquid'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  headRight: { flexDirection: 'row', gap: 8 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  logo: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  symLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  symbol: { fontSize: 22, fontFamily: 'Inter-700', fontWeight: '700' },
  levPill: { paddingHorizontal: 8, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  levText: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
  name: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 2 },
  price: { fontSize: 22, fontFamily: 'Inter-700', fontWeight: '700' },
  delta: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 2 },
  chart: { alignItems: 'center', marginTop: 20 },
  tfRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 12 },
  tf: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tfText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 16, marginTop: 20 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  about: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter-500', fontWeight: '500', paddingHorizontal: 16, paddingTop: 10 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14 },
  statLabel: { fontSize: 15, fontFamily: 'Inter-500', fontWeight: '500' },
  statValue: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, paddingHorizontal: 16 },
  ls: { flexDirection: 'row', gap: 12 },
  lsBtn: { flex: 1, height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  lsText: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  provided: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 10 },
  providedText: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500' },
});
