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
  View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, Linking, Modal, Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import CandleChart from '../components/CandleChart';
import ChartNeedsNetwork from '../components/ChartNeedsNetwork';
import { useOnlineGate } from '../hooks/useOnlineGate';
import { showToast } from '../components/Toast';
import {
  BackIcon, StarIcon, BellIcon, HistoryIcon, ChevronRight, ChevronDownIcon,
  ArrowUpRightTx, ArrowDownRightIcon, COIN_ICONS, SparkleIcon, ShareSquareIcon, TrendIcon, CandlesIcon, ArrowLeftUpIcon, HexSettingsIcon, TradingViewMark, ChevronsUpDownIcon, CheckIcon,
} from '../components/icons';
import { RANGES, INTERVALS, defaultInterval, type Range, type Interval } from '../services/candleEngine';
import TradingViewChart from '../components/TradingViewChart';
import TrendChart from '../components/TrendChart';
import { TREND_RANGES, formatScrubStamp, formatScrubChange, type TrendRange, type TrendScrub } from '../services/trendEngine';
import { intervalToResolution } from '../services/tvBridge';
import { PERP_SECTIONS, formatPerpPrice, formatChange, type PerpMarket } from '../services/perpsMarkets';
import { getMarketInfo, getMarketStats, relatedMarkets, marketName } from '../services/perpsMarketInfo';
import { usePerpsFavorites, toggleFavorite, loadPerpsFavorites } from '../services/perpsFavorites';
import { addPerpsRecent } from '../services/perpsRecents';
import { useVenuePrefs, type PerpsVenue as VenueType } from '../services/perpsVenues';

// Trust-measured action colors: deep green / deep red.
const GREEN = '#158444';
const RED = '#D63232';

const TRADINGVIEW_URL = 'https://www.tradingview.com/?utm_source=veltraviawallet.com&utm_medium=chart';

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
  // Candles are price data: no connection, no chart.
  const online = useOnlineGate();
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
  const [range, setRange] = useState<Range>('1D');
  const [interval, setIntervalState] = useState<Interval>('30m');
  const [advanced, setAdvanced] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [volumeOn, setVolumeOn] = useState(true);
  // Normal view has two faces (Trust 10:08): the TREND (line/area) chart with
  // the arrow icon, and the compact CANDLE illustration with the candle icon.
  // Tapping the arrow shows the candles; tapping the candle icon opens the
  // real candle view (Advanced). Advanced itself is always candles.
  const [chartView, setChartView] = useState<'trend' | 'candles'>('trend');
  const [trendRange, setTrendRange] = useState<TrendRange>('1D');
  const [scrub, setScrub] = useState<TrendScrub | null>(null);
  const [lineMode, setLineMode] = useState(false); // Advanced: candle <-> line on TradingView
  const pickRange = (r: Range) => { setRange(r); setIntervalState(defaultInterval(r)); };

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

  // Related markets PUSH a new market page (Trust 2026-10-28 09:42 flow):
  // BTC -> tap ZEC -> ZEC page; back returns to the BTC page, back again
  // returns to where the first market was opened from. replace() would
  // destroy the BTC page and break that back-stack walk.
  const openRelated = (m: PerpMarket) =>
    navigation.push('PerpsMarket', { venue: m.venue ?? 'hyperliquid', symbol: m.symbol });

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
              onPress={() => navigation.navigate('PerpsActivity')}
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
            <Text style={[styles.price, { color: theme.ink }]}>{formatPerpPrice(scrub ? scrub.price : market.price)}</Text>
            {scrub ? (
              <Text style={[styles.change, { color: scrub.delta >= 0 ? GREEN : RED }]}>
                {`${formatScrubChange(scrub.delta, scrub.pct)} ${formatScrubStamp(scrub.t, trendRange)}`}
              </Text>
            ) : (
              <Text style={[styles.change, { color: market.change24h >= 0 ? GREEN : RED }]}>
                {formatChange(market.change24h)}
              </Text>
            )}
          </View>
        </View>

        {/* chart (+ Advanced button in the normal view) */}
        <View style={styles.chartWrap}>
          {online.state === 'offline' ? (
            <ChartNeedsNetwork height={240} onRetry={online.recheck} retrying={false} />
          ) : online.state === 'checking' ? (
            <View style={{ height: 240 }} testID="chartChecking" />
          ) : advanced ? (
            <View style={{ height: Math.round((W || 390) * 1.05) }}>
              <TradingViewChart
                symbol={`VELTRAVIA:${symbol}`}
                seed={`${venue}:${symbol}`}
                description={`${info.name} (${symbol})`}
                exchange={venue === 'aster' ? 'Aster' : 'Hyperliquid'}
                last={market.price}
                resolution={intervalToResolution[interval]}
                chartType={lineMode ? 'line' : 'candle'}
                theme={dark ? 'dark' : 'light'}
                showVolume={volumeOn}
                colors={{
                  backgroundPrimary: theme.background,
                  brandPrimary: theme.brand,
                  successMain: GREEN,
                  errorMain: RED,
                  textSecondary: theme.inkMuted,
                  axisText: theme.inkMuted,
                }}
              />
            </View>
          ) : chartView === 'trend' ? (
            <TrendChart
              seedKey={`${venue}:${symbol}`}
              last={market.price}
              range={trendRange}
              height={300}
              dark={dark}
              onScrub={(sc) => setScrub(sc)}
              onTick={() => Vibration.vibrate(6)}
            />
          ) : (
            <CandleChart
              seedKey={`${venue}:${symbol}`}
              last={market.price}
              range={range}
              interval={interval}
              height={240}
              dark={dark}
              brand={theme.brand}
            />
          )}
          {!advanced && (
            <Pressable
              accessibilityLabel="Advanced chart"
              onPress={() => setAdvanced(true)}
              style={[styles.advancedBtn, { borderColor: dark ? 'rgba(255,255,255,0.16)' : '#D9D9DE' }]}
            >
              <ShareSquareIcon size={14} color={theme.ink} />
              <Text style={[styles.advancedText, { color: theme.ink }]}>Advanced</Text>
            </Pressable>
          )}
          {advanced && (
            <>
              <Pressable
                accessibilityLabel="TradingView"
                onPress={() => Linking.openURL(TRADINGVIEW_URL).catch(() => showToast("Couldn't open TradingView. Try again later.", { kind: 'error' }))}
                style={styles.tvLogo}
              >
                <TradingViewMark size={32} />
              </Pressable>
              <Pressable
                accessibilityLabel="Return"
                onPress={() => setAdvanced(false)}
                style={[styles.returnPill, { backgroundColor: dark ? '#1D2133' : '#F1F1F4' }]}
              >
                <ArrowLeftUpIcon size={14} color={theme.ink} />
                <Text style={[styles.returnText, { color: theme.ink }]}>Return</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Chart settings"
                onPress={() => setVolumeOn((v) => !v)}
                style={styles.hexBtn}
              >
                <HexSettingsIcon size={22} color={theme.inkMuted} />
              </Pressable>
            </>
          )}
        </View>

        {/* timeframes. Normal view: trend (arrow icon, 1H..ALL) or the candle
            illustration (candle icon, six ranges + interval). The icon is the
            toggle: arrow -> candle illustration; candle icon -> real candle
            view (Advanced). */}
        <View style={styles.tfRow}>
          {advanced ? (
            <Pressable accessibilityLabel="Chart type" onPress={() => setLineMode((v) => !v)} style={styles.tfIcon}>
              <TrendIcon size={20} color={theme.ink} />
            </Pressable>
          ) : chartView === 'trend' ? (
            <Pressable accessibilityLabel="Show candles" onPress={() => { setScrub(null); setChartView('candles'); }} style={styles.tfIcon}>
              <TrendIcon size={20} color={theme.ink} />
            </Pressable>
          ) : (
            <Pressable accessibilityLabel="Open candle view" onPress={() => { setScrub(null); setAdvanced(true); }} style={styles.tfIcon}>
              <CandlesIcon size={20} color={theme.ink} />
            </Pressable>
          )}
          {!advanced && chartView === 'trend' ? (
            TREND_RANGES.map((x) => (
              <Pressable
                key={x}
                accessibilityLabel={`Timeframe ${x}`}
                onPress={() => { setScrub(null); setTrendRange(x); }}
                style={[styles.tf, x === trendRange ? { backgroundColor: dark ? '#2A2D3E' : '#EEEEF0' } : null]}
              >
                <Text style={[styles.tfText, { color: x === trendRange ? theme.ink : theme.inkMuted }]}>{x}</Text>
              </Pressable>
            ))
          ) : (
            <>
              {RANGES.map((x) => (
                <Pressable
                  key={x}
                  accessibilityLabel={`Timeframe ${x}`}
                  onPress={() => pickRange(x)}
                  style={[styles.tf, x === range ? { backgroundColor: dark ? '#2A2D3E' : '#EEEEF0' } : null]}
                >
                  <Text style={[styles.tfText, { color: x === range ? theme.ink : theme.inkMuted }]}>{x}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityLabel="Candle interval" onPress={() => setPickerOpen(true)} style={styles.tf}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.tfText, { color: theme.ink }]}>{interval}</Text>
                  <ChevronsUpDownIcon size={14} color={theme.ink} />
                </View>
              </Pressable>
            </>
          )}
        </View>

        {advanced && (
          <View style={[styles.indicators, { backgroundColor: dark ? '#12162A' : '#F4F4F6' }]}>
            <View>
              <Text style={[styles.indLabel, { color: theme.inkMuted }]}>Indicators</Text>
              <Text style={[styles.indValue, { color: theme.ink }]}>{volumeOn ? 'Volume' : 'None'}</Text>
            </View>
            <Pressable
              accessibilityLabel="Manage indicators"
              onPress={() => setVolumeOn((v) => !v)}
              style={[styles.manageBtn, { backgroundColor: dark ? 'rgba(108,99,255,0.22)' : '#E6E4FF' }]}
            >
              <Text style={[styles.manageText, { color: theme.brand }]}>Manage</Text>
            </Pressable>
          </View>
        )}

        {!advanced && (<>
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
        </>)}
      </ScrollView>

      {/* interval picker */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setPickerOpen(false)}>
          <View style={[styles.pickerSheet, { backgroundColor: theme.background }]}>
            <Text style={[styles.pickerTitle, { color: theme.ink }]}>Candle interval</Text>
            {INTERVALS.map((iv) => (
              <Pressable key={iv} accessibilityLabel={`Interval ${iv}`} onPress={() => { setIntervalState(iv); setPickerOpen(false); }} style={styles.pickerRow}>
                <Text style={[styles.pickerText, { color: theme.ink, fontWeight: iv === interval ? '700' : '500' }]}>{iv}</Text>
                {iv === interval && <CheckIcon size={18} color={theme.brand} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* bottom bar */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 10, backgroundColor: theme.background }]}>
        <View style={styles.lsRow}>
          <Pressable
            accessibilityLabel="Long"
            onPress={() => navigation.navigate('PerpsTrade', { venue, symbol, side: 'long' })}
            style={[styles.lsBtn, { backgroundColor: GREEN }]}
          >
            <Text style={styles.lsText}>Long</Text>
            <ArrowUpRightTx size={18} color="#FFFFFF" />
          </Pressable>
          <Pressable
            accessibilityLabel="Short"
            onPress={() => navigation.navigate('PerpsTrade', { venue, symbol, side: 'short' })}
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
  chartWrap: { marginHorizontal: 0, marginTop: 8, paddingLeft: 0 },
  advancedBtn: { position: 'absolute', left: 16, bottom: 34, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, height: 28, backgroundColor: 'rgba(255,255,255,0.72)' },
  advancedText: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },
  tfRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  tfIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  tf: { height: 34, borderRadius: 17, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  tfText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  tvLogo: { position: 'absolute', left: 6, bottom: 34, width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  returnPill: { position: 'absolute', left: 52, bottom: 36, flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, borderRadius: 17, paddingHorizontal: 12 },
  returnText: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600' },
  hexBtn: { position: 'absolute', right: 6, bottom: 2, width: 32, height: 28, alignItems: 'center', justifyContent: 'center' },
  indicators: { marginHorizontal: 16, marginTop: 4, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  indLabel: { fontSize: 14, fontFamily: 'Inter-500' },
  indValue: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700', marginTop: 4 },
  manageBtn: { height: 40, borderRadius: 20, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  manageText: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.28)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },
  pickerTitle: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700', marginBottom: 6 },
  pickerRow: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerText: { fontSize: 16, fontFamily: 'Inter-500' },
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
