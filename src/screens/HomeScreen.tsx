/**
 * Veltravia Wallet — Home screen (matches the approved mockup 1:1).
 *
 * Top → bottom:
 *   header   : V mark + "Veltravia Wallet" · bell · avatar
 *   card     : purple→blue gradient, "Total Balance" + eye toggle,
 *              big USD value, ≈ NGN, 24h change chip, and a sparkline of the
 *              TOTAL portfolio value over the last 7 days (all holdings,
 *              not one coin's price — services/portfolio). Tap → Balance Details.
 *   actions  : Send · Receive · Swap · Buy (individually tinted tiles)
 *   market   : Market Overview, BTC/ETH/BNB/SOL cards with sparklines
 *   portfolio: donut breakdown with the total in the middle + legend
 *   activity : Recent Transactions (received / sent / swapped)
 *   footer   : Wallet Security + Portfolio Insights cards
 *
 * Balance data flows from services/portfolio (holdings × prices, with
 * transaction deltas). Mock feeds until Phase 2; the combiner is final.
 * The balance-hide toggle is real and already works.
 */

import PrimaryButton from '../components/PrimaryButton';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Alert } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useWallets } from '../wallets/WalletsProvider';
import { WalletAvatar } from '../wallets/WalletAvatar';
import Sparkline from '../components/Sparkline';
import DonutChart from '../components/DonutChart';
import {
  BellIcon,
  ScanIcon,
  EyeIcon,
  ChevronRight,
  SendIcon,
  ReceiveIcon,
  SwapIcon,
  BuyIcon,
  ArrowUpSmall,
  ArrowDownSmall,
  ShieldCheckIcon,
  CloseIcon,
  COIN_ICONS,
  ClockIcon,
  BarsIcon,
  ArrowDownTx,
  ArrowUpRightTx,
  SwapArrowsTx,
  ShieldLockIcon,
  TrendIcon,
} from '../components/icons';

// Portfolio value over time comes from the portfolio engine
// (services/portfolio) — total of ALL holdings, not one coin's price.
import { portfolioSeries, totalValue, change24h as change24hAll, type PortfolioPoint } from '../services/portfolio';

interface Market {
  symbol: string;
  price: number;
  change: number;
  series: number[];
}
const MOCK_MARKETS: Market[] = [
  { symbol: 'BTC', price: 68245.32, change: 2.8, series: [5, 5.6, 5.2, 6.4, 6, 7.2, 6.8, 8.1, 7.6, 9] },
  { symbol: 'ETH', price: 3452.17, change: 1.9, series: [6, 5.4, 6.2, 5.8, 7, 6.6, 7.4, 7.1, 8, 8.4] },
  { symbol: 'BNB', price: 562.41, change: 2.4, series: [4, 4.8, 4.4, 5.6, 5.2, 6.4, 6, 7, 6.6, 7.8] },
  { symbol: 'SOL', price: 148.32, change: 3.6, series: [3, 3.8, 3.4, 4.8, 4.4, 5.8, 5.2, 6.6, 6.4, 8] },
];

// Portfolio split. Segment colours stay inside the Veltravia violet-to-blue
// family, with green/amber as the two accent categories from the mockup.
const MOCK_PORTFOLIO = [
  { label: 'Ethereum', ticker: 'ETH', pct: 48, color: '#2F6BF0' },
  { label: 'Bitcoin', ticker: 'BTC', pct: 24, color: '#8B5CF6' },
  { label: 'BNB', ticker: 'BNB', pct: 15, color: '#18B981' },
  { label: 'Others', ticker: '', pct: 13, color: '#F5A623' },
];

type TxKind = 'received' | 'sent' | 'swapped';
interface Tx {
  kind: TxKind;
  title: string;
  sub: string;
  amount: string;
  fiat: string;
}
const MOCK_TXS: Tx[] = [
  { kind: 'received', title: 'Received ETH', sub: 'From 0x7a3...9f4e  ·  Today, 08:42', amount: '+0.05 ETH', fiat: '$172.61' },
  { kind: 'sent', title: 'Sent USDT', sub: 'To 0x9b2...1c6d  ·  Yesterday, 16:20', amount: '-100 USDT', fiat: '$100.00' },
  { kind: 'swapped', title: 'Swapped BNB → ETH', sub: 'Via PancakeSwap  ·  Yesterday, 12:15', amount: '+0.08 ETH', fiat: '$275.36' },
];

const NGN_RATE = 1559; // placeholder; Phase 2 reads this from the price API

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type ActionKey = 'send' | 'receive' | 'swap' | 'buy';
const ACTIONS: { key: ActionKey; label: string; Icon: React.ComponentType<any> }[] = [
  { key: 'send', label: 'Send', Icon: SendIcon },
  { key: 'receive', label: 'Receive', Icon: ReceiveIcon },
  { key: 'swap', label: 'Swap', Icon: SwapIcon },
  { key: 'buy', label: 'Buy', Icon: BuyIcon },
];

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [hidden, setHidden] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { activeWallet } = useWallets();

  // Total portfolio + live 7D history. Phase 2 replaces the mock inside
  // the service; these lines do not change.
  const total = totalValue();
  const c24 = change24hAll();
  const series7d = React.useMemo(() => portfolioSeries('7D'), []);
  const sparkData = series7d.points.map((p: PortfolioPoint) => p.value);

  const topInset = 0; // status bar offset is applied natively in MainActivity
  const chipBg = theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(60,64,90,0.10)';
  const H_PAD = 16;
  const cardW = width - H_PAD * 2;
  const mask = '••••••';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* RN 0.87 is always edge-to-edge; only the icon style is ours. */}
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: H_PAD, paddingTop: topInset + 68 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Balance card (opens Balance Details) ---------- */}
        <Pressable onPress={() => navigation.navigate('BalanceDetails')} style={{ marginBottom: 20 }}>
        <LinearGradient
          colors={[...theme.cardGradient]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.55 }}
          end={{ x: 1, y: 0.45 }}
          style={[styles.card, { width: cardW }]}
        >
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Total Balance</Text>
            <Pressable hitSlop={10} onPress={() => setHidden((h) => !h)}>
              <EyeIcon size={16} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>
          <Text style={styles.cardValue}>{hidden ? '$••••••' : `$${fmt(total)}`}</Text>
          <Text style={styles.cardSub}>
            ≈ ₦{hidden ? mask : fmt(total * NGN_RATE)}
          </Text>
          <View style={styles.changeChip}>
            {c24 >= 0 ? (
              <ArrowUpSmall size={13} color="#7CFFB8" />
            ) : (
              <ArrowDownSmall size={13} color="#FF9BB3" />
            )}
            <Text style={[styles.changeChipText, { color: c24 >= 0 ? '#7CFFB8' : '#FF9BB3' }]}>
              {c24 >= 0 ? '+' : ''}{c24.toFixed(1)}%
            </Text>
            <Text style={styles.changeChipSub}>(24h)</Text>
          </View>
          <View style={styles.sparkWrap} pointerEvents="none">
            <Sparkline data={sparkData} width={cardW * 0.5} height={78} strokeWidth={2.2} id="hero" />
          </View>
        </LinearGradient>
        </Pressable>

        {/* ---------- Backup nudge (Trust-style) ---------- */}
        {!activeWallet.backedUp && !bannerDismissed && (
          <View style={[styles.backupBanner, { backgroundColor: theme.mode === 'dark' ? '#1A1608' : '#FFF8E6', borderColor: theme.mode === 'dark' ? '#3A2E10' : '#F2E3B3' }]}>
            <View style={styles.backupIcon}>
              <ShieldCheckIcon size={20} color={theme.warning} />
            </View>
            <View style={styles.backupTextWrap}>
              <Text style={[styles.backupTitle, { color: theme.ink }]}>Back up your wallet</Text>
              <Text style={[styles.backupSub, { color: theme.inkMuted }]}>
                Keep your recovery phrase safe. It is the only way to restore your funds.
              </Text>
            </View>
            <Pressable hitSlop={10} onPress={() => setBannerDismissed(true)}>
              <CloseIcon size={16} color={theme.inkMuted} />
            </Pressable>
            <View style={styles.backupBtnWrap}>
              <PrimaryButton
                label="Back up"
                height={30}
                fontSize={13}
                arrow={false}
                onPress={() =>
                  Alert.alert(
                    'Back up your wallet',
                    'The secure backup flow (seed phrase reveal and verification) arrives with the Wallet Core integration. Until then, keep your device safe.',
                    [{ text: 'Got it' }],
                  )
                }
              />
            </View>
          </View>
        )}

        {/* ---------- Quick actions ---------- */}
        <View style={styles.actions}>
          {ACTIONS.map(({ key, label, Icon }) => {
            const [bg, fg] = theme.tiles[key];
            return (
              <Pressable
                key={key}
                style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => {}}
              >
                <View style={[styles.actionTile, { backgroundColor: bg }]}>
                  <Icon size={26} color={fg} />
                </View>
                <Text style={[styles.actionLabel, { color: theme.ink }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* ---------- Market Overview ---------- */}
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.panelHeader}>
            <View style={styles.panelTitleRow}>
              <View style={[styles.panelBadge, { backgroundColor: theme.surfaceAlt }]}>
                <BarsIcon size={16} color={theme.brand} />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.ink }]}>Market Overview</Text>
            </View>
            <Pressable
              style={styles.seeAllRow}
              hitSlop={8}
              onPress={() => navigation.navigate('Markets')}
            >
              <Text style={[styles.seeAll, { color: theme.inkMuted }]}>View All</Text>
              <ChevronRight size={14} color={theme.inkMuted} />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.marketRow}
          >
            {MOCK_MARKETS.map((m) => {
              const Coin = COIN_ICONS[m.symbol];
              return (
                <Pressable
                  key={m.symbol}
                  onPress={() => navigation.navigate('Markets')}
                  style={({ pressed }) => [
                    styles.marketCard,
                    { backgroundColor: theme.background, borderColor: theme.border, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <View style={styles.marketTop}>
                    {Coin ? <Coin size={28} /> : null}
                    <Text style={[styles.marketSym, { color: theme.ink }]}>{m.symbol}</Text>
                  </View>
                  <Text style={[styles.marketPrice, { color: theme.ink }]}>${fmt(m.price)}</Text>
                  <View style={styles.changeRow}>
                    <ArrowUpSmall size={11} color={theme.positive} />
                    <Text style={[styles.marketChange, { color: theme.positive }]}>{m.change.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.marketSpark} pointerEvents="none">
                    <Sparkline
                      data={m.series}
                      width={92}
                      height={30}
                      color={theme.positive}
                      strokeWidth={1.6}
                      id={`mk-${m.symbol}`}
                    />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ---------- Portfolio Breakdown ---------- */}
        <Pressable
          style={({ pressed }) => [
            styles.panel,
            styles.portfolioPanel,
            { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => {}}
        >
          <DonutChart
            segments={MOCK_PORTFOLIO.map((p) => ({ value: p.pct, color: p.color }))}
            size={112}
            thickness={17}
            trackColor={theme.border}
          >
            <Text style={[styles.donutValue, { color: theme.ink }]}>
              {hidden ? '$••••' : `$${fmt(total)}`}
            </Text>
          </DonutChart>

          <View style={styles.portfolioInfo}>
            <View style={styles.portfolioTitleRow}>
              <Text style={[styles.sectionTitle, { color: theme.ink }]}>Portfolio Breakdown</Text>
              <ChevronRight size={16} color={theme.inkMuted} />
            </View>
            {MOCK_PORTFOLIO.map((p) => (
              <View key={p.label} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: p.color }]} />
                <Text style={[styles.legendPct, { color: theme.ink }]}>{p.pct}%</Text>
                <Text style={[styles.legendName, { color: theme.ink }]} numberOfLines={1}>
                  {p.label}
                  {p.ticker ? <Text style={{ color: theme.inkMuted }}>{`  (${p.ticker})`}</Text> : null}
                </Text>
              </View>
            ))}
          </View>
        </Pressable>

        {/* ---------- Recent Transactions ---------- */}
        <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.panelHeader}>
            <View style={styles.panelTitleRow}>
              <ClockIcon size={20} color={theme.brand} />
              <Text style={[styles.sectionTitle, { color: theme.ink }]}>Recent Transactions</Text>
            </View>
            <Pressable
              style={styles.seeAllRow}
              hitSlop={8}
              onPress={() => navigation.navigate('Activity')}
            >
              <Text style={[styles.seeAll, { color: theme.inkMuted }]}>See All</Text>
              <ChevronRight size={14} color={theme.inkMuted} />
            </Pressable>
          </View>

          {MOCK_TXS.map((t, i) => {
            const tone =
              t.kind === 'received'
                ? { bg: '#2FB562', Icon: ArrowDownTx }
                : t.kind === 'sent'
                  ? { bg: '#7B4DDB', Icon: ArrowUpRightTx }
                  : { bg: '#2F7BF0', Icon: SwapArrowsTx };
            const positive = t.amount.startsWith('+');
            return (
              <Pressable
                key={t.title}
                onPress={() => navigation.navigate('Activity')}
                style={({ pressed }) => [
                  styles.txRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={[styles.txIcon, { backgroundColor: tone.bg }]}>
                  <tone.Icon size={20} color="#FFFFFF" />
                </View>
                <View style={styles.txMain}>
                  <Text style={[styles.txTitle, { color: theme.ink }]} numberOfLines={1}>{t.title}</Text>
                  <Text style={[styles.txSub, { color: theme.inkMuted }]} numberOfLines={1}>{t.sub}</Text>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, { color: positive ? theme.positive : theme.ink }]}>
                    {hidden ? '••••' : t.amount}
                  </Text>
                  <Text style={[styles.txFiat, { color: theme.inkMuted }]}>{hidden ? '$••••' : t.fiat}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ---------- Wallet Security + Portfolio Insights ---------- */}
        <View style={styles.tilesRow}>
          <Pressable
            style={({ pressed }) => [
              styles.infoCard,
              { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => navigation.navigate('Settings')}
          >
            <View style={[styles.infoIcon, { backgroundColor: theme.surfaceAlt }]}>
              <ShieldLockIcon size={20} color={theme.brand} />
            </View>
            <View style={styles.infoText}>
              <View style={styles.infoTitleRow}>
                <Text style={[styles.infoTitle, { color: theme.ink }]} numberOfLines={1}>Wallet Security</Text>
              </View>
              <View style={[styles.protectedPill, { backgroundColor: 'rgba(24,185,129,0.14)' }]}>
                <Text style={[styles.protectedText, { color: theme.positive }]}>Protected</Text>
              </View>
              <Text style={[styles.infoSub, { color: theme.inkMuted }]} numberOfLines={2}>
                Your assets are safe and secure.
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.infoCard,
              { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => navigation.navigate('Markets')}
          >
            <View style={[styles.infoIcon, { backgroundColor: theme.surfaceAlt }]}>
              <TrendIcon size={20} color={theme.brand} />
            </View>
            <View style={styles.infoText}>
              <Text style={[styles.infoTitle, { color: theme.ink }]} numberOfLines={1}>Portfolio Insights</Text>
              <Text style={[styles.infoSub, { color: theme.inkMuted }]} numberOfLines={3}>
                Track performance & trends.
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
        {/* ---------- Header (pill = active wallet, opens Wallets) ---------- */}
        <View style={[styles.headerFloat, { top: topInset + 4 }]}>
          <Pressable
            style={({ pressed }) => [styles.brandRow, { backgroundColor: chipBg, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => navigation.navigate('Wallets')}
          >
            <WalletAvatar icon={activeWallet.icon} color={activeWallet.color} size={34} />
            <Text style={[styles.brand, { color: theme.ink }]} numberOfLines={1}>
              {activeWallet.name}
            </Text>
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable
              hitSlop={8}
              onPress={() => navigation.navigate('Activity')}
              style={[styles.scanBtn, { backgroundColor: chipBg }]}
            >
              <BellIcon size={22} color={theme.ink} />
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => {}}
              style={[styles.scanBtn, { backgroundColor: chipBg }]}
            >
              <ScanIcon size={22} color={theme.ink} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 72, paddingBottom: 150 },

  headerFloat: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingLeft: 6,
    paddingRight: 18,
    borderRadius: 23,
  },
  brand: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700', letterSpacing: -0.2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scanBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 20,
  },
  backupIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,166,35,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupTextWrap: { flex: 1, gap: 2 },
  backupTitle: { fontSize: 14, fontFamily: 'Inter-700', fontWeight: '700' },
  backupSub: { fontFamily: 'Inter-400', fontSize: 12, lineHeight: 16 },
  backupBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  backupBtnWrap: { width: 84, marginLeft: 4 },
  backupBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter-700', fontWeight: '700' },

  card: {
    alignSelf: 'center',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    minHeight: 168,
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500' },
  cardValue: {
    color: '#fff',
    fontSize: 34,
    fontFamily: 'Inter-700', fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  cardSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 4, fontFamily: 'Inter-500', fontWeight: '500' },
  sparkWrap: { position: 'absolute', right: 14, bottom: 14 },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 26,
  },
  actionItem: { alignItems: 'center', width: 72 },
  actionTile: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },

  panel: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelBadge: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700', letterSpacing: -0.2 },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500' },

  changeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  changeChipText: { fontSize: 13, fontFamily: 'Inter-700', fontWeight: '700' },
  changeChipSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500' },

  marketRow: { gap: 10, paddingRight: 2 },
  marketCard: {
    width: 118,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    overflow: 'hidden',
  },
  marketTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  marketSym: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
  marketPrice: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700', letterSpacing: -0.2 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  marketChange: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },
  marketSpark: { marginTop: 6, marginLeft: -2 },

  portfolioPanel: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  donutValue: { fontSize: 12, fontFamily: 'Inter-700', fontWeight: '700' },
  portfolioInfo: { flex: 1 },
  portfolioTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendPct: { width: 34, fontSize: 13, fontFamily: 'Inter-700', fontWeight: '700' },
  legendName: { flex: 1, fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500' },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txMain: { flex: 1 },
  txTitle: { fontSize: 14, fontFamily: 'Inter-700', fontWeight: '700' },
  txSub: { fontSize: 11.5, fontFamily: 'Inter-400', marginTop: 3 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontFamily: 'Inter-700', fontWeight: '700' },
  txFiat: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 3 },

  tilesRow: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  infoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    minHeight: 92,
  },
  infoIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1 },
  infoTitleRow: { flexDirection: 'row', alignItems: 'center' },
  infoTitle: { fontSize: 13.5, fontFamily: 'Inter-700', fontWeight: '700' },
  protectedPill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 4,
  },
  protectedText: { fontSize: 10.5, fontFamily: 'Inter-700', fontWeight: '700' },
  infoSub: { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter-400', marginTop: 5 },
});
