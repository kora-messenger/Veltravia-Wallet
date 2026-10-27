/**
 * Veltravia Wallet — Perps home (Trust parity).
 *
 * Two layouts, chosen by the PERPS account balance (a separate account from
 * the main wallet balance — see services/perpsAccount):
 *   - Not funded: hero "Deposit to fund your first position" + Deposit button.
 *   - Funded:     balance header (Perps balance + Deposit/Withdraw), no hero.
 * Below it: Popular / New / Crypto / Stocks / Forex / Meme market lists with a
 * sparkline per row, and the floating Long / Short pills above the tab bar.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { useWallets } from '../wallets/WalletsProvider';
import Sparkline from '../components/Sparkline';
import {
  HistoryIcon, GearIcon, SearchIcon, ChevronRight, ChevronDownIcon,
  PlusIcon, MinusIcon, COIN_ICONS,
  ArrowUpRightTx, ArrowDownRightIcon,
} from '../components/icons';
import { SkeletonBlock } from '../components/Skeleton';
import {
  usePerpsAccount, accountValue, isFunded,
  perpsSessionLoaded, ensurePerpsSessionLoad,
} from '../services/perpsAccount';
import { useVenuePrefs } from '../services/perpsVenues';
import {
  PERP_SECTIONS, formatPerpPrice, formatChange, perpSpark, type PerpMarket,
} from '../services/perpsMarkets';

// Trust-measured action colors: deep green / deep red (Long / Short, P&L, ticks)
const GREEN = '#158444';
const RED = '#D63232';
// App violet (#6C63FF) darkened to Trust's button depth for Perps CTAs.
const VIOLET_DEEP = '#5147E6';
const FOOTER_CLEAR = 190; // Long/Short pills + floating tab bar

function usd(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

export default function PerpsScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { activeWallet } = useWallets();
  const account = usePerpsAccount(activeWallet.id);
  const funded = isFunded(account);
  const [hideBalance, setHideBalance] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);
  const hlPrefs = useVenuePrefs('hyperliquid');
  const asterPrefs = useVenuePrefs('aster');

  // Balance fetch runs once per fresh app open; later visits render instantly.
  const [loading, setLoading] = useState(!perpsSessionLoaded());
  useEffect(() => {
    if (!loading) return;
    let alive = true;
    ensurePerpsSessionLoad().then(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loading]);

  const chipBg = dark ? '#1D2133' : '#EEEEF0';
  // Trust: solid dark-gray header circles with white icons (light mode)
  const headerChipBg = dark ? '#1D2133' : '#2C2C31';
  const headerIconColor = dark ? theme.ink : '#FFFFFF';
  // Balance pill: light-gray container (light) / navy tile (dark)
  const pillBg = dark ? '#0D1626' : '#F2F2F2';
  const pillCircleBg = dark ? '#1D2133' : '#FFFFFF';
  const leverageBg = dark ? 'rgba(255,255,255,0.10)' : '#EEEEF3';

  // "Show in markets" (Settings > Perps > venue): hidden venues drop out of
  // the lists; sections left empty hide completely.
  const sections = useMemo(
    () => PERP_SECTIONS.map((s) => ({
      ...s,
      rows: s.markets
        .filter((m) => (m.venue ?? 'hyperliquid') === 'aster' ? asterPrefs.showInMarkets : hlPrefs.showInMarkets)
        .map((m) => ({ m, spark: perpSpark(`${s.key}:${m.symbol}`, m.change24h) })),
    })).filter((s) => s.rows.length > 0),
    [hlPrefs.showInMarkets, asterPrefs.showInMarkets],
  );

  const openDeposit = () => navigation.navigate('PerpsDeposit', { mode: 'deposit' });
  const openWithdraw = () => navigation.navigate('PerpsDeposit', { mode: 'withdraw' });

  const value = accountValue(account);
  const pnl = account.unrealizedPnl;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSide}>
          <Pressable accessibilityLabel="Perps history" style={[styles.circle, { backgroundColor: chipBg }]} onPress={() => navigation.navigate('PerpsAbout')}>
            <HistoryIcon size={22} color={headerIconColor} />
          </Pressable>
          <Pressable accessibilityLabel="Perps settings" style={[styles.circle, { backgroundColor: headerChipBg }]} onPress={() => navigation.navigate('PerpsAbout')}>
            <GearIcon size={22} color={headerIconColor} />
          </Pressable>
        </View>
        <Text style={[styles.title, { color: theme.ink }]}>Perps</Text>
        <View style={[styles.headerSide, { justifyContent: 'flex-end' }]}>
          <Pressable accessibilityLabel="Search perps" style={[styles.circle, { backgroundColor: headerChipBg }]}>
            <SearchIcon size={22} color={headerIconColor} />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: FOOTER_CLEAR + insets.bottom }}>
        {loading ? (
          // ---- LOADING: balance fetch on fresh app open (Trust skeleton) ---
          <View style={styles.balanceBlock}>
            <SkeletonBlock style={styles.skBig} />
            <SkeletonBlock style={styles.skSmall} />
            <View style={[styles.availPill, { backgroundColor: pillBg }]}>
              <View style={styles.availPillLeft}>
                <View style={styles.availHead}>
                  <Text style={[styles.availLabel, { color: theme.inkMuted }]}>Available balance</Text>
                  <ChevronDownIcon size={16} color={theme.inkMuted} />
                </View>
                <SkeletonBlock style={styles.skAvail} />
              </View>
              <View style={styles.availPillActions}>
                <Pressable accessibilityLabel="Deposit" style={[styles.pillCircle, { backgroundColor: pillCircleBg }]} onPress={openDeposit}>
                  <PlusIcon size={22} color={theme.brand} />
                </Pressable>
                <Pressable accessibilityLabel="Withdraw" style={[styles.pillCircle, { backgroundColor: pillCircleBg }]} onPress={openWithdraw}>
                  <MinusIcon size={22} color={theme.brand} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : funded ? (
          // ---- FUNDED: balance header (Trust layout) -----------------------
          <View style={styles.balanceBlock}>
            <Pressable onPress={() => setHideBalance((v) => !v)}>
              <Text style={[styles.balanceLabel, { color: theme.inkMuted }]}>Perps balance</Text>
              <Text style={[styles.balanceValue, { color: theme.ink }]}>{hideBalance ? '••••••' : usd(value)}</Text>
            </Pressable>
            <Text style={[styles.pnl, { color: pnl >= 0 ? GREEN : RED }]}>
              {hideBalance ? '••••' : `${pnl >= 0 ? '+' : '-'}${usd(Math.abs(pnl))}`}
            </Text>
            <View style={[styles.availPill, { backgroundColor: pillBg }]}>
              <View style={styles.availPillLeft}>
                <Pressable style={styles.availHead} onPress={() => setAvailOpen((v) => !v)}>
                  <Text style={[styles.availLabel, { color: theme.inkMuted }]}>Available balance</Text>
                  <ChevronDownIcon size={16} color={theme.inkMuted} />
                </Pressable>
                <Text style={[styles.availValue, { color: theme.ink }]}>{hideBalance ? '••••' : usd(account.available)}</Text>
                {availOpen ? (
                  <View style={styles.availBreakdown}>
                    <View style={styles.availBreakRow}>
                      <Text style={[styles.availBreakLabel, { color: theme.inkMuted }]}>Margin in positions</Text>
                      <Text style={[styles.availBreakValue, { color: theme.ink }]}>{usd(account.inPositions)}</Text>
                    </View>
                    <View style={styles.availBreakRow}>
                      <Text style={[styles.availBreakLabel, { color: theme.inkMuted }]}>Unrealized P&L</Text>
                      <Text style={[styles.availBreakValue, { color: pnl >= 0 ? GREEN : RED }]}>{`${pnl >= 0 ? '+' : '-'}${usd(Math.abs(pnl))}`}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
              <View style={styles.availPillActions}>
                <Pressable accessibilityLabel="Deposit" style={({ pressed }) => [styles.pillCircle, { backgroundColor: pillCircleBg, opacity: pressed ? 0.7 : 1 }]} onPress={openDeposit}>
                  <PlusIcon size={22} color={theme.brand} />
                </Pressable>
                <Pressable accessibilityLabel="Withdraw" style={({ pressed }) => [styles.pillCircle, { backgroundColor: pillCircleBg, opacity: pressed ? 0.7 : 1 }]} onPress={openWithdraw}>
                  <MinusIcon size={22} color={theme.brand} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          // ---- NOT FUNDED: deposit hero -------------------------------------
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={[styles.heroTitle, { color: theme.ink }]}>Deposit to fund{'\n'}your first position</Text>
              <Image
                source={require('../assets/perps-infinity-gold.png')}
                style={styles.heroArtImg}
                resizeMode="contain"
                accessibilityLabel="Perps"
              />
            </View>
            <Pressable style={({ pressed }) => [styles.depositBtn, { backgroundColor: VIOLET_DEEP, opacity: pressed ? 0.85 : 1 }]} onPress={openDeposit}>
              <Text style={styles.depositText}>Deposit</Text>
            </Pressable>
          </View>
        )}

        {!loading && sections.map((s) => (
          <View key={s.key} style={styles.section}>
            <Pressable style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: theme.ink }]}>{s.title}</Text>
              <ChevronRight size={18} color={theme.ink} />
            </Pressable>
            {s.rows.map(({ m, spark }) => {
              const up = m.change24h >= 0;
              const col = up ? GREEN : RED;
              return (
                <Pressable key={`${s.key}-${m.symbol}`} style={({ pressed }) => [styles.row, pressed && { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#F1F1F4' }]}>
                  <MarketLogo m={m} />
                  <View style={styles.rowLeft}>
                    <View style={styles.symbolLine}>
                      <Text style={[styles.symbol, { color: theme.ink }]} numberOfLines={1}>{m.symbol}</Text>
                      <View style={[styles.levPill, { backgroundColor: leverageBg }]}>
                        <Text style={[styles.levText, { color: theme.inkMuted }]}>{m.leverage}x</Text>
                      </View>
                    </View>
                    <Text style={[styles.vol, { color: theme.inkMuted }]}>{m.volume}</Text>
                  </View>
                  <Sparkline data={spark} width={90} height={44} color={col} strokeWidth={1.6} fill="flat" sharp id={`${s.key}-${m.symbol}`} />
                  <View style={styles.rowRight}>
                    <Text style={[styles.price, { color: theme.ink }]}>{formatPerpPrice(m.price)}</Text>
                    <Text style={[styles.change, { color: col }]}>{formatChange(m.change24h)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Long / Short pills float above the tab bar */}
      <View pointerEvents="box-none" style={[styles.ls, { bottom: 104 + insets.bottom }]}>
        <Pressable style={({ pressed }) => [styles.lsBtn, { backgroundColor: GREEN, opacity: pressed ? 0.88 : 1 }]}>
          <Text style={styles.lsText}>Long</Text>
          <ArrowUpRightTx size={18} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.lsBtn, { backgroundColor: RED, opacity: pressed ? 0.88 : 1 }]}>
          <Text style={styles.lsText}>Short</Text>
          <ArrowDownRightIcon size={18} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  headerSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },

  hero: { paddingHorizontal: 16, paddingTop: 22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { fontSize: 24, lineHeight: 30, fontFamily: 'Inter-700', fontWeight: '700', flexShrink: 1 },
  heroArt: { width: 120, alignItems: 'center', justifyContent: 'center' },
  heroArtImg: { width: 132, height: 79 },
  depositBtn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  depositText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },

  balanceBlock: { paddingHorizontal: 16, paddingTop: 20 },
  balanceLabel: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500' },
  balanceValue: { fontSize: 38, lineHeight: 46, fontFamily: 'Inter-700', fontWeight: '700', marginTop: 2 },
  pnl: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 2 },
  skBig: { width: 170, height: 36, borderRadius: 8, marginTop: 6 },
  skSmall: { width: 96, height: 16, borderRadius: 8, marginTop: 10 },
  skAvail: { width: 110, height: 15, borderRadius: 8, marginTop: 6 },
  availPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderRadius: 20,
    padding: 16,
    marginTop: 20,
  },
  availPillLeft: { flex: 1 },
  availHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  availLabel: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500' },
  availValue: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700', marginTop: 6 },
  availPillActions: { flexDirection: 'row', gap: 10 },
  pillCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availBreakdown: { marginTop: 12, gap: 8 },
  availBreakRow: { flexDirection: 'row', justifyContent: 'space-between' },
  availBreakLabel: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500' },
  availBreakValue: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },

  section: { marginTop: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingBottom: 6 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowLeft: { flex: 1, minWidth: 0 },
  symbolLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  symbol: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', flexShrink: 1 },
  levPill: { paddingHorizontal: 8, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  levText: { fontSize: 11, fontFamily: 'Inter-600', fontWeight: '600' },
  vol: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', minWidth: 92 },
  price: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  change: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 2 },

  ls: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', gap: 14, paddingHorizontal: 26 },
  lsBtn: { flex: 1, height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  lsText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },
});
