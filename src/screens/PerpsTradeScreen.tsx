/**
 * Perps trade ticket (Trust recording, Oct 28 2026).
 *
 * Reached from Long / Short: the market list (PerpsSearchScreen in long/short
 * mode) or the Market Detail bottom bar. Layout:
 *
 *   - top: market header (logo + venue badge, "40x", price, day change). While
 *     a candle is held on the chart this swaps for Open / High / Low / Close,
 *     the candle's date and its signed change (red/green); release restores it.
 *   - middle: compact candle chart with an "Expand" pill.
 *   - bottom: draggable sheet with THREE snaps (peek, half, full). Half is the
 *     default; full covers the screen and adds "Liquidation price".
 *   - Dragging the sheet to peek (or tapping Expand) turns the chart into the
 *     large view: "Collapse" pill, 1H 1D 1W 1M 1Y YTD AI + interval picker and
 *     an Indicators card (Volume / Manage).
 *
 * Money safety: nothing here moves funds. The CTA is "Fund wallet" while the
 * venue balance is $0 and "Open Long/Short" afterwards, which (until signing
 * is wired) only shows an informational toast.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, PanResponder, ScrollView, LayoutChangeEvent,
  useWindowDimensions, Vibration, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { useWallets } from '../wallets/WalletsProvider';
import {
  CloseIcon, OrderBookIcon, CandlesIcon, ChevronRight, ChevronsUpDownIcon, ExpandArrowsIcon,
  CollapseArrowsIcon, COIN_ICONS, HexSettingsIcon,
} from '../components/icons';
import { SwapIcon } from '../components/icons';
import { HyperliquidTile, AsterTile } from '../components/PerpsVenueMarks';
import CandleChart from '../components/CandleChart';
import OrderBookView from '../components/OrderBookView';
import OrderBookSettingsSheet from '../components/OrderBookSettingsSheet';
import { showToast } from '../components/Toast';
import LockedNotice from '../components/LockedNotice';
import type { MovementBlock } from '../core/security/valueGuard';
import { movementBlock } from '../core/security/valueGuard';
import { FONT } from '../theme/typography';
import { PERP_SECTIONS, formatPerpPrice, type PerpMarket } from '../services/perpsMarkets';
import { providerBalance, usePerpsAccount } from '../services/perpsAccount';
import { addPerpsRecent } from '../services/perpsRecents';
import type { Candle } from '../services/candleEngine';
import {
  buildOrderBook, DEFAULT_BOOK_SETTINGS, groupOptionsFor, type BookSettings,
} from '../services/orderBook';
import type { Interval } from '../services/candleEngine';
import {
  type SheetSnap, type TradeSide, snapHeights, settleSnap, sideTitle, amountFromPercent,
  percentFromAmount, positionSize, liquidationPrice, ctaFor, formatUsd, formatSize,
  ohlcHeader, formatOhlcDelta, SLIDER_STOPS, TRADE_FEE_PCT, DEFAULT_LEVERAGE,
} from '../services/perpsTrade';

const GREEN = '#158444';
const RED = '#D63232';
const BRAND_BTN = '#392EFA'; // Trust's solid CTA blue, kept for the Fund wallet pill

const RANGES = ['1H', '1D', '1W', '1M', '1Y', 'YTD', 'AI'] as const;
type Rng = (typeof RANGES)[number];
const CHART_INTERVALS: Interval[] = ['5m', '15m', '30m', '1h', '4h', '1d'];

export function findTradeMarket(venue: string, symbol: string): PerpMarket | undefined {
  return PERP_SECTIONS.flatMap((s) => s.markets).find(
    (m) => m.symbol === symbol && (m.venue ?? 'hyperliquid') === venue,
  );
}

function MarketTile({ m, size = 44 }: { m: PerpMarket; size?: number }) {
  const Icon = COIN_ICONS[m.symbol];
  if (Icon) return <Icon size={size} />;
  const t = m.tile ?? { bg: '#E9EAEE', fg: '#555A66', text: m.symbol[0] };
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.fg, fontFamily: FONT.bold, fontSize: t.text.length > 2 ? 11 : 18 }}>{t.text}</Text>
    </View>
  );
}

/* ------------------------------- amount slider ------------------------------ */
function AmountSlider({ percent, onChange, dark }: { percent: number; onChange: (p: number) => void; dark: boolean }) {
  const [w, setW] = useState(0);
  const wRef = useRef(0);
  const cb = useRef(onChange);
  cb.current = onChange;
  const THUMB = 28;
  const toPercent = (x: number) => {
    const span = Math.max(1, wRef.current - THUMB);
    return Math.max(0, Math.min(100, ((x - THUMB / 2) / span) * 100));
  };
  const pan = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => cb.current(toPercent(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => cb.current(toPercent(e.nativeEvent.locationX)),
      onPanResponderTerminationRequest: () => false,
    }),
    [],
  );
  const onLayout = (e: LayoutChangeEvent) => { wRef.current = e.nativeEvent.layout.width; setW(e.nativeEvent.layout.width); };
  const span = Math.max(0, w - THUMB);
  const left = (percent / 100) * span;
  return (
    <View accessibilityLabel={`Amount ${Math.round(percent)} percent`} onLayout={onLayout} style={styles.sliderHit} {...pan.panHandlers}>
      <View style={[styles.sliderTrack, { backgroundColor: dark ? '#252A3D' : '#ECECEE' }]} pointerEvents="none" />
      {SLIDER_STOPS.slice(1).map((s) => (
        <View key={s} pointerEvents="none" style={[styles.stopDot, { left: THUMB / 2 + (s / 100) * span - 3, backgroundColor: dark ? '#4A5070' : '#C4C6CE' }]} />
      ))}
      <View pointerEvents="none" style={[styles.thumb, { left, borderColor: dark ? '#2A2F45' : '#E4E4EA' }]} />
    </View>
  );
}

/* ----------------------------------- row ----------------------------------- */
function FormRow({ label, value, onPress, dark, theme, chevron = true, border = false, accessibilityLabel }: {
  label: string; value: string; onPress?: () => void; dark: boolean; theme: any; chevron?: boolean; border?: boolean; accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, border && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dark ? '#252A3D' : '#E7E7EC' }]}
    >
      <Text style={[styles.rowLabel, { color: theme.inkMuted }]}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, { color: theme.ink }]} numberOfLines={1}>{value}</Text>
        {chevron ? <ChevronRight size={16} color={theme.inkMuted} /> : null}
      </View>
    </Pressable>
  );
}

export default function PerpsTradeScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { height: H } = useWindowDimensions();
  const { activeWallet } = useWallets();
  const account = usePerpsAccount(activeWallet.id);

  const symbol: string = route.params?.symbol ?? 'BTC';
  const venue: 'hyperliquid' | 'aster' = route.params?.venue === 'aster' ? 'aster' : 'hyperliquid';
  const side: TradeSide = route.params?.side === 'long' ? 'long' : 'short';
  const market = useMemo(() => findTradeMarket(venue, symbol), [venue, symbol]);

  useEffect(() => { if (market) addPerpsRecent(market as any); }, [market]);

  const pageBg = dark ? theme.background : '#FCFCFC';
  const chipBg = dark ? '#1E2133' : '#EEEDF0';
  const balance = providerBalance(activeWallet.id, venue);
  void account; // re-render on balance changes

  /* ------------- form state ------------- */
  const [percent, setPercent] = useState(0);
  const [leverage] = useState(Math.min(DEFAULT_LEVERAGE, market?.leverage ?? DEFAULT_LEVERAGE));
  const amount = amountFromPercent(percent, balance);
  const size = positionSize(amount, leverage);
  const price = market?.price ?? 0;
  const liq = liquidationPrice(price, leverage, side, amount);
  const cta = ctaFor(side, balance, amount);

  /* ------------- chart state ------------- */
  const [expanded, setExpanded] = useState(false);       // large chart (peek)
  const [range, setRange] = useState<Rng>('1D');
  const [interval, setIntervalState] = useState<Interval>('30m');
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [candleMode, setCandleMode] = useState(true);    // blue toggle: candles vs line
  const [scrub, setScrub] = useState<Candle | null>(null);
  const [chartReady, setChartReady] = useState(false);
  // list icon: swap the chart for the order book (tap again to return)
  const [showBook, setShowBook] = useState(false);
  const [bookSettings, setBookSettings] = useState<BookSettings>(DEFAULT_BOOK_SETTINGS);
  const [bookSettingsOpen, setBookSettingsOpen] = useState(false);
  const [bookTick, setBookTick] = useState(0);
  useEffect(() => {
    if (!showBook) return undefined;
    const id = setInterval(() => setBookTick((t) => t + 1), 1000); // sizes refresh ~1s
    return () => clearInterval(id);
  }, [showBook]);
  const book = useMemo(
    () => buildOrderBook(`${venue}:${symbol}`, price, bookSettings.group, bookTick),
    [venue, symbol, price, bookSettings.group, bookTick],
  );
  const bookGroups = useMemo(() => groupOptionsFor(price), [price]);
  useEffect(() => { const t = setTimeout(() => setChartReady(true), 450); return () => clearTimeout(t); }, []);

  /* ------------- three-snap sheet ------------- */
  const heights = useMemo(() => snapHeights(H, insets.top), [H, insets.top]);
  const [snap, setSnap] = useState<SheetSnap>('half');
  const [lockBlock, setLockBlock] = useState<MovementBlock>(null);
  const walletId = activeWallet.id;
  const sheetH = useRef(new Animated.Value(heights.half)).current;
  const curH = useRef(heights.half);
  const dragStart = useRef(heights.half);

  const goSnap = useCallback((s: SheetSnap) => {
    setSnap(s);
    // "peek" is also the large-chart state; half/full return to the compact chart
    setExpanded(s === 'peek');
    Animated.spring(sheetH, { toValue: heights[s], useNativeDriver: false, bounciness: 0, speed: 18 }).start();
    curH.current = heights[s];
  }, [heights, sheetH]);

  useEffect(() => { sheetH.setValue(heights[snap]); curH.current = heights[snap]; }, [heights]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => { dragStart.current = curH.current; sheetH.stopAnimation((v) => { curH.current = v; dragStart.current = v; }); },
      onPanResponderMove: (_e, g) => {
        const next = Math.max(heights.peek, Math.min(heights.full, dragStart.current - g.dy));
        sheetH.setValue(next);
        curH.current = next;
      },
      onPanResponderRelease: (_e, g) => {
        // vy is px/ms, positive = finger moving down
        goSnap(settleSnap(curH.current, g.vy, heights));
      },
    }),
    [heights, goSnap, sheetH],
  );

  const onExpand = () => goSnap('peek');
  const onCollapse = () => goSnap('half');

  /* ------------- header (price or OHLC scrub) ------------- */
  const up = (market?.change24h ?? 0) >= 0;
  const oh = scrub ? ohlcHeader({ t: scrub.t, o: scrub.open, h: scrub.high, l: scrub.low, c: scrub.close }) : null;
  const dayDelta = price - price / (1 + (market?.change24h ?? 0) / 100);

  const openFund = () => navigation.navigate('PerpsPayWith', { venue });
  const onCta = () => {
    if (cta.action === 'fund') return navigation.navigate('PerpsDeposit');
    if (cta.action === 'open') {
      // Opening a position is value movement: a locked wallet may not trade.
      const block = movementBlock(activeWallet.id);
      if (block) {
        setLockBlock(block);
        return;
      }
      Vibration.vibrate(12);
      showToast('Order signing arrives with live data', { kind: 'info' });
    }
  };

  const chartH = expanded ? Math.max(260, H - heights.peek - insets.top - 220) : 230;
  const sheetBg = dark ? '#12141F' : '#FCFCFC';
  const isFull = snap === 'full';

  if (!market) {
    return (
      <View style={[styles.root, { backgroundColor: pageBg, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: theme.inkMuted, fontFamily: FONT.regular }}>Market not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* ---------- top: header or OHLC scrub ---------- */}
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        {oh ? (
          <View testID="ohlcHeader">
            <View style={styles.ohlcRow}>
              {([['Open', oh.open], ['High', oh.high], ['Low', oh.low], ['Close', oh.close]] as const).map(([k, v]) => (
                <View key={k} style={styles.ohlcCell}>
                  <Text style={[styles.ohlcLabel, { color: theme.inkMuted }]}>{k}</Text>
                  <Text style={[styles.ohlcValue, { color: theme.ink }]}>{`$${Math.round(v).toLocaleString('en-US')}`}</Text>
                </View>
              ))}
            </View>
            <View style={styles.ohlcRow2}>
              <Text style={[styles.ohlcDate, { color: theme.inkMuted }]}>{new Date(scrub!.t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
              <Text style={[styles.ohlcDelta, { color: oh.up ? GREEN : RED }]}>{formatOhlcDelta(oh)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.headRow} testID="marketHeader">
            <View style={styles.logoWrap}>
              <MarketTile m={market} size={44} />
              <View style={[styles.venueBadge, { borderColor: pageBg }]}>
                {venue === 'aster' ? <AsterTile size={20} /> : <HyperliquidTile size={20} />}
              </View>
            </View>
            <Text style={[styles.symbol, { color: theme.ink }]}>{market.symbol}</Text>
            <View style={[styles.levPill, { backgroundColor: chipBg }]}>
              <Text style={[styles.levText, { color: theme.inkMuted }]}>{`${market.leverage}x`}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.price, { color: theme.ink }]}>{`$${formatPerpPrice(price).replace(/^\$/, '')}`}</Text>
              <Text style={[styles.change, { color: up ? GREEN : RED }]}>
                {`${up ? '+' : '-'}$${Math.abs(dayDelta).toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} (${Math.abs(market.change24h).toFixed(2)}%)`}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ---------- order book (replaces the chart) ---------- */}
      {showBook ? (
        <View style={styles.bookWrap}>
          <OrderBookView
            book={book}
            currency={bookSettings.currency}
            group={bookSettings.group}
            dark={dark}
            ink={theme.ink}
            inkMuted={theme.inkMuted}
            onOpenSettings={() => setBookSettingsOpen(true)}
          />
        </View>
      ) : null}

      {/* ---------- chart ---------- */}
      {!showBook ? (
      <View style={[styles.chartWrap, { height: chartH }]}>
        {chartReady ? (
          <CandleChart
            seedKey={`${venue}:${symbol}`}
            last={price}
            range={(range === 'AI' ? '1D' : range) as any}
            interval={interval}
            height={chartH}
            interactive
            showVolume={expanded}
            dark={dark}
            brand={theme.brand}
            line={!candleMode}
            onScrubChange={setScrub}
          />
        ) : (
          <View style={styles.spinnerBox} testID="chartSpinner"><Text style={{ color: theme.brand, fontFamily: FONT.medium }}>···</Text></View>
        )}
        <Pressable
          accessibilityLabel={expanded ? 'Collapse chart' : 'Expand chart'}
          onPress={expanded ? onCollapse : onExpand}
          style={[styles.expandPill, { backgroundColor: dark ? '#1E2133' : '#FFFFFF' }]}
        >
          {expanded ? <CollapseArrowsIcon size={16} color={theme.inkMuted} /> : <ExpandArrowsIcon size={16} color={theme.inkMuted} />}
          <Text style={[styles.expandText, { color: theme.inkMuted }]}>{expanded ? 'Collapse' : 'Expand'}</Text>
        </Pressable>
        {expanded ? (
          <View style={styles.hexBtn}><HexSettingsIcon size={22} color={theme.inkMuted} /></View>
        ) : null}
      </View>
      ) : null}

      {/* ---------- expanded-chart extras: timeframes + indicators ---------- */}
      {expanded && !showBook ? (
        <View testID="chartExtras">
          <View style={styles.tfRow}>
            {RANGES.map((r) => {
              const sel = r === range;
              return (
                <Pressable key={r} accessibilityLabel={`Range ${r}`} onPress={() => setRange(r)} style={[styles.tf, sel && { backgroundColor: chipBg }]}>
                  <Text style={[styles.tfText, { color: sel ? theme.ink : theme.inkMuted }]}>{r}</Text>
                </Pressable>
              );
            })}
            <Pressable accessibilityLabel="Interval" onPress={() => setIntervalOpen((o) => !o)} style={styles.intervalBtn}>
              <Text style={[styles.tfText, { color: theme.ink }]}>{interval}</Text>
              <ChevronsUpDownIcon size={14} color={theme.ink} />
            </Pressable>
          </View>
          {intervalOpen ? (
            <View style={[styles.intervalMenu, { backgroundColor: dark ? '#1E2133' : '#FFFFFF' }]}>
              {CHART_INTERVALS.map((iv) => (
                <Pressable key={iv} accessibilityLabel={`Interval ${iv}`} onPress={() => { setIntervalState(iv); setIntervalOpen(false); }} style={styles.intervalItem}>
                  <Text style={[styles.tfText, { color: iv === interval ? theme.brand : theme.ink }]}>{iv}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={[styles.indCard, { backgroundColor: chipBg }]}>
            <View>
              <Text style={[styles.indLabel, { color: theme.inkMuted }]}>Indicators</Text>
              <Text style={[styles.indValue, { color: theme.ink }]}>Volume</Text>
            </View>
            <Pressable accessibilityLabel="Manage indicators" onPress={() => showToast('Indicators are coming soon', { kind: 'info' })} style={[styles.manage, { backgroundColor: dark ? '#2A2F55' : '#E3E1FB' }]}>
              <Text style={[styles.manageText, { color: dark ? '#A9A4FF' : BRAND_BTN }]}>Manage</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ---------- draggable sheet ---------- */}
      <Animated.View testID="tradeSheet" style={[styles.sheet, { height: sheetH, backgroundColor: sheetBg, paddingBottom: insets.bottom + 8 }]}>
        <View {...pan.panHandlers} style={styles.grabber} testID="sheetGrabber">
          <View style={[styles.handle, { backgroundColor: dark ? '#3A3F58' : '#CCCCD4' }]} />
          <View style={styles.sheetHead}>
            <Pressable accessibilityLabel="Close ticket" onPress={() => navigation.goBack()} style={[styles.xBtn, { backgroundColor: chipBg }]}>
              <CloseIcon size={22} color={theme.ink} />
            </Pressable>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.sheetTitle, { color: theme.ink }]}>{sideTitle(side)}</Text>
              <View style={styles.orderType}>
                <Text style={[styles.orderTypeText, { color: theme.inkMuted }]}>Market</Text>
                <ChevronsUpDownIcon size={13} color={theme.inkMuted} />
              </View>
            </View>
            <Pressable
              accessibilityLabel="Order book"
              accessibilityState={{ selected: showBook }}
              onPress={() => { setShowBook((b) => !b); if (!showBook && snap === 'peek') goSnap('half'); }}
              style={[styles.iconBtn, { backgroundColor: showBook ? (dark ? '#2A2F55' : '#E3E1FB') : chipBg }]}
            >
              <OrderBookIcon size={22} color={showBook ? (dark ? '#A9A4FF' : BRAND_BTN) : theme.ink} />
            </Pressable>
            <Pressable
              accessibilityLabel="Toggle candles"
              onPress={() => setCandleMode((c) => !c)}
              style={[styles.iconBtn, { backgroundColor: candleMode ? (dark ? '#2A2F55' : '#E3E1FB') : chipBg, marginLeft: 8 }]}
            >
              <CandlesIcon size={22} color={candleMode ? (dark ? '#A9A4FF' : BRAND_BTN) : theme.ink} />
            </Pressable>
          </View>
        </View>

        {snap !== 'peek' ? (
          <ScrollView scrollEnabled={false} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.amountBlock, isFull && { paddingTop: 70 }]}>
              <Text testID="amountText" style={[styles.amount, { color: amount > 0 ? theme.ink : (dark ? '#4A4F66' : '#D3D2D5') }]}>{formatUsd(amount)}</Text>
              <View style={styles.sizeRow}>
                <Text style={[styles.sizeText, { color: theme.inkMuted }]}>{`Size: ${formatSize(size)}`}</Text>
                <SwapIcon size={14} color={theme.inkMuted} />
              </View>
              <View style={styles.sliderBox}>
                <AmountSlider percent={percentFromAmount(amount, balance)} onChange={setPercent} dark={dark} />
              </View>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.rows}>
              <FormRow label="Leverage" value={`Cross ${leverage}x`} onPress={() => showToast('Leverage picker arrives with live data', { kind: 'info' })} dark={dark} theme={theme} />
              <FormRow label="Take profit / stop loss" value="None" onPress={() => showToast('TP/SL arrives with live data', { kind: 'info' })} dark={dark} theme={theme} />
              {isFull ? (
                <FormRow label="Liquidation price" value={liq == null ? '—' : `$${formatPerpPrice(liq).replace(/^\$/, '')}`} chevron={false} border dark={dark} theme={theme} />
              ) : null}
              <FormRow
                label="Pay with"
                value={`Perps balance · ${formatUsd(balance)}`}
                onPress={openFund}
                border={!isFull}
                dark={dark}
                theme={theme}
              />
            </View>
          </ScrollView>
        ) : null}

        {snap !== 'peek' ? (
          <View style={styles.ctaBlock}>
            {lockBlock ? (
              <View style={{ marginBottom: 10 }}>
                <LockedNotice block={lockBlock} compact />
              </View>
            ) : null}
            <Pressable
              accessibilityLabel={cta.label}
              disabled={cta.action === 'disabled'}
              onPress={onCta}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: cta.action === 'disabled' ? (dark ? '#252A3D' : '#E7E7EC') : cta.action === 'fund' ? BRAND_BTN : side === 'long' ? GREEN : RED, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={[styles.ctaText, { color: cta.action === 'disabled' ? (dark ? '#5B5F78' : '#B5B6C0') : '#FFFFFF' }]}>{cta.label}</Text>
            </Pressable>
            <Text style={[styles.footer, { color: dark ? '#5B5F78' : '#C6C7CD' }]}>{`Risk disclosure • ${TRADE_FEE_PCT}% fee`}</Text>
          </View>
        ) : null}
      </Animated.View>

      <OrderBookSettingsSheet
        visible={bookSettingsOpen}
        settings={bookSettings}
        baseSymbol={market.symbol}
        groups={bookGroups}
        onClose={() => setBookSettingsOpen(false)}
        onApply={setBookSettings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { paddingHorizontal: 20, minHeight: 100 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWrap: { width: 48, height: 48 },
  venueBadge: { position: 'absolute', right: -4, bottom: -4, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#0F1B17' },
  symbol: { fontFamily: FONT.bold, fontSize: 22, lineHeight: 28 },
  levPill: { paddingHorizontal: 9, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  levText: { fontFamily: FONT.medium, fontSize: 13 },
  price: { fontFamily: FONT.bold, fontSize: 24, lineHeight: 30 },
  change: { fontFamily: FONT.medium, fontSize: 14, lineHeight: 19 },
  ohlcRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ohlcCell: { flex: 1 },
  ohlcLabel: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 18 },
  ohlcValue: { fontFamily: FONT.semiBold, fontSize: 18, lineHeight: 24 },
  ohlcRow2: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  ohlcDate: { fontFamily: FONT.regular, fontSize: 14 },
  ohlcDelta: { fontFamily: FONT.medium, fontSize: 14 },
  chartWrap: { marginTop: 8 },
  bookWrap: { marginTop: 4 },
  spinnerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  expandPill: { position: 'absolute', left: 12, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  expandText: { fontFamily: FONT.medium, fontSize: 14 },
  hexBtn: { position: 'absolute', right: 12, bottom: 8 },
  tfRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 8, gap: 4 },
  tf: { paddingHorizontal: 14, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tfText: { fontFamily: FONT.medium, fontSize: 15 },
  intervalBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 8 },
  intervalMenu: { position: 'absolute', right: 16, top: 44, borderRadius: 14, paddingVertical: 6, minWidth: 90, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, elevation: 8, zIndex: 20 },
  intervalItem: { paddingHorizontal: 18, paddingVertical: 10 },
  indCard: { marginHorizontal: 20, marginTop: 14, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  indLabel: { fontFamily: FONT.regular, fontSize: 14 },
  indValue: { fontFamily: FONT.semiBold, fontSize: 17, marginTop: 2 },
  manage: { paddingHorizontal: 16, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  manageText: { fontFamily: FONT.semiBold, fontSize: 15 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  grabber: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 8 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center' },
  xBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontFamily: FONT.bold, fontSize: 18, lineHeight: 24 },
  orderType: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderTypeText: { fontFamily: FONT.medium, fontSize: 15, lineHeight: 20 },
  iconBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  amountBlock: { alignItems: 'center', paddingTop: 18 },
  amount: { fontFamily: FONT.bold, fontSize: 48, lineHeight: 58 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  sizeText: { fontFamily: FONT.medium, fontSize: 15 },
  sliderBox: { alignSelf: 'stretch', paddingHorizontal: 20, marginTop: 28 },
  sliderHit: { height: 40, justifyContent: 'center' },
  sliderTrack: { height: 26, borderRadius: 13 },
  stopDot: { position: 'absolute', top: 17, width: 6, height: 6, borderRadius: 3 },
  thumb: { position: 'absolute', top: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },
  rows: { paddingHorizontal: 20 },
  row: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontFamily: FONT.regular, fontSize: 16 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontFamily: FONT.semiBold, fontSize: 16 },
  ctaBlock: { paddingHorizontal: 20, paddingTop: 10 },
  cta: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FONT.semiBold, fontSize: 18 },
  footer: { textAlign: 'center', fontFamily: FONT.regular, fontSize: 13, marginTop: 10 },
});
