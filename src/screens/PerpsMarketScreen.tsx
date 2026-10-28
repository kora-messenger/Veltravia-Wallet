/**
 * Veltravia Wallet — Perps market page (Trust parity, rebuilt step by step
 * from the 2026-10-28 screenshots).
 *
 * Layout (top to bottom):
 *   - header: back | star, bell, history
 *   - asset row: logo, symbol + leverage pill, name | price + 24h change
 *   - candle chart with an "Advanced" outline button
 *   - timeframe chips: 1H 1D 1W 1M 1Y YTD 30m▾
 *   - "About <name>" (AI-written, View more, AI disclaimer)
 *   - Stats: 24h volume / Open interest / Funding rate, "View performance >"
 *   - Related markets: horizontal cards
 *   - bottom: Long / Short, "Provided by <venue>"
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import CandleChart from '../components/CandleChart';
import Sparkline from '../components/Sparkline';
import { showToast } from '../components/Toast';
import {
  BackIcon, StarIcon, BellIcon, HistoryIcon, ChevronRight, ChevronDownIcon,
  ArrowUpRightTx, ArrowDownRightIcon, COIN_ICONS, SparkleIcon, ShareSquareIcon,
} from '../components/icons';
import { PERP_SECTIONS, formatPerpPrice, formatChange, type PerpMarket } from '../services/perpsMarkets';
import { getMarketInfo, getMarketStats, relatedMarkets, marketName } from '../services/perpsMarketInfo';
import { usePerpsFavorites, toggleFavorite, loadPerpsFavorites } from '../services/perpsFavorites';
import { addPerpsRecent } from '../services/perpsRecents';
import { useVenuePrefs, type PerpsVenue as VenueType } from '../services/perpsVenues';

// Trust-measured action colors: deep green / deep red.
const GREEN = '#158444';
const RED = '#D63232';

const TIMEFRAMES = ['1H', '1D', '1W', '1M', '1Y', 'YTD', '30m'];

/** Resolve a market from the dataset (exported for tests). */
export function findMarket(venue: string, symbol: string): PerpMarket | undefined {
  return PERP_SECTIONS.flatMap((s) => s.markets).find(
    (m) => m.symbol === symbol && (m.venue ?? 'hyperliquid') === venue,
  );
}

function MarketTile({ m, size = 28 }: { m: PerpMarket; size?: number }) {
  const Icon = COIN_ICONS[m.symbol];
  if (Icon) return <Icon size={size} />;
  const t = m.tile;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t?.bg ?? '#EEE', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t?.fg ?? '#000', fontSize: size * 0.34, fontFamily: 'Inter-700', fontWeight: '700' }}>{t?.text ?? m.symbol.slice(0, 2)}</Text>
    </View>
  );
}

export default function PerpsMarketScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width: W } = useWindowDimensions();

  const symbol: string = route.params?.symbol ?? 'BTC';
  const venue: VenueType = route.params?.venue === 'aster' ? 'aster' : 'hyperliquid';

  const market = useMemo(() => findMarket(venue, symbol), [venue, symbol]);
  const info = getMarketInfo(symbol);
  const stats = market ? getMarketStats(market) : null;
  const related = market ? relatedMarkets(market) : [];

  const favorites = usePerpsFavorites();
  // same format as favKey(market): "<venue>:<symbol>"
  const key = `${venue}:${symbol}`;
  const isFav = favorites.has(key);

  const [aboutOpen, setAboutOpen] = useState(false);
  const [tf, setTf] = useState('1D');

  // opening a market records it in Recents
  useEffect(() => {
    loadPerpsFavorites();
    if (symbol) addPerpsRecent({ venue, symbol });
  }, [venue, symbol]);

  if (!market) {
    // safe fallback for an unknown market
    return (
      <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={[styles.circle, { backgroundColor: dark ? '#1D2133' : '#EEEEF0' }]}>
            <BackIcon size={22} color={theme.ink} />
          </Pressable>
          <Text style={[styles.symbol, { color: theme.ink }]}>{symbol}</Text>
        </View>
        <View style={styles.missing}>
          <Text style={{ color: theme.inkMuted, fontSize: 14 }}>This market is not available right now.</Text>
        </View>
      </View>
    );
  }

  const chipBg = dark ? '#1D2133' : '#EEEEF0';
  const cardBg = dark ? '#12162A' : '#F4F4F4';
  const hairline = dark ? 'rgba(255,255,255,0.08)' : '#EFEFF2';

  const openRelated = (m: PerpMarket) =>
    navigation.replace('PerpsMarket', { venue: m.venue ?? 'hyperliquid', symbol: m.symbol });

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 150 }}>
        {/* header */}
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={[styles.circle, { backgroundColor: chipBg }]}>
            <BackIcon size={22} color={theme.ink} />
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable
              accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
              onPress={() => toggleFavorite(key)}
              style={[styles.circle, { backgroundColor: chipBg }]}
            >
              <StarIcon size={20} color={isFav ? '#F5B728' : theme.ink} filled={isFav} />
            </Pressable>
            <Pressable
              accessibilityLabel="Set price alert"
              onPress={() => showToast('Price alerts arrive with live data', { kind: 'info' })}
              style={[styles.circle, { backgroundColor: chipBg }]}
            >
              <BellIcon size={20} color={theme.ink} />
            </Pressable>
            <Pressable
              accessibilityLabel="Market history"
              onPress={() => navigation.navigate('Activity')}
              style={[styles.circle, { backgroundColor: chipBg }]}
            >
              <HistoryIcon size={20} color={theme.ink} />
            </Pressable>
          </View>
        </View>

        {/* asset row */}
        <View style={styles.assetRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <MarketTile m={market} size={38} />
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.symbol, { color: theme.ink }]}>{market.symbol}</Text>
                <View style={[styles.levPill, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : '#EEEEF3' }]}>
                  <Text style={[styles.levText, { color: theme.inkMuted }]}>{`${market.leverage}x`}</Text>
                </View>
              </View>
              <Text style={[styles.assetName, { color: theme.inkMuted }]}>{info.name}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.price, { color: theme.ink }]}>{formatPerpPrice(market.price)}</Text>
            <Text style={[styles.change, { color: market.change24h >= 0 ? GREEN : RED }]}>
              {formatChange(market.change24h)}
            </Text>
          </View>
        </View>

        {/* chart + Advanced */}
        <View style={styles.chartWrap}>
          <CandleChart seedKey={`${symbol}:${tf}`} last={market.price} color={theme.brand} />
          <Pressable
            accessibilityLabel="Advanced chart"
            onPress={() => showToast('Advanced charts arrive with live data', { kind: 'info' })}
            style={[styles.advancedBtn, { borderColor: dark ? 'rgba(255,255,255,0.16)' : '#D9D9DE' }]}
          >
            <ShareSquareIcon size={14} color={theme.ink} />
            <Text style={[styles.advancedText, { color: theme.ink }]}>Advanced</Text>
          </Pressable>
        </View>

        {/* timeframes */}
        <View style={styles.tfRow}>
          {TIMEFRAMES.map((x) => (
            <Pressable
              key={x}
              accessibilityLabel={`Timeframe ${x}`}
              onPress={() => setTf(x)}
              style={[styles.tf, x === tf ? { backgroundColor: dark ? '#2C2C31' : '#1A1A1D' } : null]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={[styles.tfText, { color: x === tf ? '#FFFFFF' : theme.ink }]}>{x}</Text>
                {x === '30m' && <ChevronDownIcon size={10} color={x === tf ? '#FFFFFF' : theme.ink} />}
              </View>
            </Pressable>
          ))}
        </View>

        {/* About (AI-written) */}
        <Pressable accessibilityLabel="About" onPress={() => setAboutOpen((v) => !v)} style={styles.sectionHead}>
          <SparkleIcon size={16} color={theme.brand} />
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>{`About ${info.name}`}</Text>
          <ChevronRight size={16} color={theme.inkMuted} />
        </Pressable>
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={[styles.aboutText, { color: dark ? '#B9BBD0' : '#3C3C43' }]} numberOfLines={aboutOpen ? undefined : 3}>
            {info.about}
          </Text>
          <Pressable accessibilityLabel={aboutOpen ? 'View less' : 'View more'} onPress={() => setAboutOpen((v) => !v)}>
            <Text style={[styles.viewMore, { color: theme.inkMuted }]}>{aboutOpen ? 'View less' : 'View more'}</Text>
          </Pressable>
          {aboutOpen && <Text style={[styles.aiDisclaimer, { color: theme.inkMuted }]}>{AI_DISCLAIMER_TEXT}</Text>}
        </View>

        {/* Stats */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Stats</Text>
          <Pressable accessibilityLabel="View performance" onPress={() => showToast('Performance view arrives with live data', { kind: 'info' })}>
            <Text style={[styles.viewMore, { color: theme.inkMuted }]}>View performance ›</Text>
          </Pressable>
        </View>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          {stats && ([
            ['24h volume', stats.volume],
            ['Open interest', stats.openInterest],
            ['Funding rate', `${stats.funding} (${stats.fundingTime})`],
          ] as const).map(([label, value], i, arr) => (
            <View key={label} style={[styles.statRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: hairline }]}>
              <Text style={[styles.statLabel, { color: theme.inkMuted }]}>{label}</Text>
              <Text style={[styles.statValue, { color: theme.ink }]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Related markets */}
        <Text style={[styles.sectionTitle, { color: theme.ink, paddingHorizontal: 16, paddingTop: 18 }]}>Related markets</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingTop: 10 }}>
          {related.map((m) => (
            <Pressable key={m.symbol} onPress={() => openRelated(m)} style={[styles.relCard, { backgroundColor: cardBg }]}>
              <MarketTile m={m} size={28} />
              <Text style={[styles.relSymbol, { color: theme.ink }]}>{m.symbol}</Text>
              <Text style={[styles.relPrice, { color: theme.ink }]}>{formatPerpPrice(m.price)}</Text>
              <Text style={[styles.relChange, { color: m.change24h >= 0 ? GREEN : RED }]}>{formatChange(m.change24h)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>

      {/* bottom bar */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 10, backgroundColor: theme.background }]}>
        <View style={styles.lsRow}>
          <Pressable
            accessibilityLabel="Long"
            onPress={() => showToast('Trade tickets arrive with live data', { kind: 'info' })}
            style={[styles.lsBtn, { backgroundColor: GREEN }]}
          >
            <Text style={styles.lsText}>Long</Text>
            <ArrowUpRightTx size={18} color="#FFFFFF" />
          </Pressable>
          <Pressable
            accessibilityLabel="Short"
            onPress={() => showToast('Trade tickets arrive with live data', { kind: 'info' })}
            style={[styles.lsBtn, { backgroundColor: RED }]}
          >
            <Text style={styles.lsText}>Short</Text>
            <ArrowDownRightIcon size={18} color="#FFFFFF" />
          </Pressable>
        </View>
        <Pressable
          accessibilityLabel="Provided by"
          onPress={() => navigation.navigate('PerpsVenue', { venue })}
          style={styles.providerRow}
        >
          <Text style={[styles.providerText, { color: theme.inkMuted }]}>Provided by</Text>
          <Text style={[styles.providerName, { color: theme.ink }]}>{venue === 'aster' ? 'Aster' : 'Hyperliquid'}</Text>
          <ChevronDownIcon size={12} color={theme.inkMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const AI_DISCLAIMER_TEXT =
  'This description has been generated by AI. It has been generated for informational purposes only, and should not be taken as financial advice.';

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  headerRight: { flexDirection: 'row', gap: 8 },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  assetRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  symbol: { fontSize: 22, fontFamily: 'Inter-800', fontWeight: '800' },
  levPill: { paddingHorizontal: 7, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  levText: { fontSize: 11, fontFamily: 'Inter-600', fontWeight: '600' },
  assetName: { fontSize: 13, fontFamily: 'Inter-500', marginTop: 1 },
  price: { fontSize: 20, fontFamily: 'Inter-800', fontWeight: '800' },
  change: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 2 },
  chartWrap: { marginHorizontal: 16, marginTop: 8 },
  advancedBtn: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, height: 28, backgroundColor: 'rgba(255,255,255,0.72)' },
  advancedText: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },
  tfRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 12, flexWrap: 'wrap' },
  tf: { height: 28, borderRadius: 14, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  tfText: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700', flex: 1 },
  aboutText: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter-400' },
  viewMore: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 6 },
  aiDisclaimer: { fontSize: 11, lineHeight: 15, marginTop: 10, marginBottom: 4 },
  card: { marginHorizontal: 16, borderRadius: 14, paddingHorizontal: 14 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  statLabel: { fontSize: 13, fontFamily: 'Inter-500' },
  statValue: { fontSize: 13, fontFamily: 'Inter-700', fontWeight: '700' },
  relCard: { width: 104, borderRadius: 14, padding: 10, gap: 4, alignItems: 'flex-start' },
  relSymbol: { fontSize: 13, fontFamily: 'Inter-700', fontWeight: '700' },
  relPrice: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },
  relChange: { fontSize: 11, fontFamily: 'Inter-600', fontWeight: '600' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10 },
  lsRow: { flexDirection: 'row', gap: 10 },
  lsBtn: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  lsText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700' },
  providerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 },
  providerText: { fontSize: 12, fontFamily: 'Inter-500' },
  providerName: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
