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
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { useWallets } from '../wallets/WalletsProvider';
import Sparkline from '../components/Sparkline';
import {
  HistoryIcon, GearIcon, SearchIcon, ChevronRight, COIN_ICONS,
  InfinityIcon, ArrowUpRightTx, ArrowDownRightIcon,
} from '../components/icons';
import { usePerpsAccount, accountValue, isFunded } from '../services/perpsAccount';
import {
  PERP_SECTIONS, formatPerpPrice, formatChange, perpSpark, type PerpMarket,
} from '../services/perpsMarkets';

const GREEN = '#15894B';
const RED = '#D9342B';
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

  const chipBg = dark ? '#1D2133' : '#EEEEF0';
  const leverageBg = dark ? 'rgba(255,255,255,0.10)' : '#EEEEF3';

  const sections = useMemo(
    () => PERP_SECTIONS.map((s) => ({
      ...s,
      rows: s.markets.map((m) => ({ m, spark: perpSpark(`${s.key}:${m.symbol}`, m.change24h) })),
    })),
    [],
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
            <HistoryIcon size={22} color={theme.ink} />
          </Pressable>
          <Pressable accessibilityLabel="Perps settings" style={[styles.circle, { backgroundColor: chipBg }]} onPress={() => navigation.navigate('PerpsAbout')}>
            <GearIcon size={22} color={theme.ink} />
          </Pressable>
        </View>
        <Text style={[styles.title, { color: theme.ink }]}>Perps</Text>
        <View style={[styles.headerSide, { justifyContent: 'flex-end' }]}>
          <Pressable accessibilityLabel="Search perps" style={[styles.circle, { backgroundColor: chipBg }]}>
            <SearchIcon size={22} color={theme.ink} />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: FOOTER_CLEAR + insets.bottom }}>
        {funded ? (
          // ---- FUNDED: perps balance replaces the deposit hero -------------
          <View style={styles.balanceBlock}>
            <Pressable onPress={() => setHideBalance((v) => !v)}>
              <Text style={[styles.balanceLabel, { color: theme.inkMuted }]}>Perps balance</Text>
              <Text style={[styles.balanceValue, { color: theme.ink }]}>{hideBalance ? '••••••' : usd(value)}</Text>
            </Pressable>
            <Text style={[styles.pnl, { color: pnl >= 0 ? GREEN : RED }]}>
              {hideBalance ? '••••' : `${pnl >= 0 ? '+' : '-'}${usd(Math.abs(pnl))}`}
            </Text>
            <View style={styles.availRow}>
              <Text style={[styles.availLabel, { color: theme.inkMuted }]}>Available balance</Text>
              <Text style={[styles.availValue, { color: theme.ink }]}>{hideBalance ? '••••' : usd(account.available)}</Text>
            </View>
            <View style={styles.balanceActions}>
              <Pressable style={({ pressed }) => [styles.balanceBtn, { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 }]} onPress={openDeposit}>
                <Text style={styles.balanceBtnText}>Deposit</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.balanceBtn, { backgroundColor: chipBg, opacity: pressed ? 0.85 : 1 }]} onPress={openWithdraw}>
                <Text style={[styles.balanceBtnText, { color: theme.ink }]}>Withdraw</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          // ---- NOT FUNDED: deposit hero -------------------------------------
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={[styles.heroTitle, { color: theme.ink }]}>Deposit to fund{'\n'}your first position</Text>
              <View style={styles.heroArt}>
                <InfinityIcon size={84} color={theme.brand} strokeWidth={3.2} />
              </View>
            </View>
            <Pressable style={({ pressed }) => [styles.depositBtn, { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 }]} onPress={openDeposit}>
              <Text style={styles.depositText}>Deposit</Text>
            </Pressable>
          </View>
        )}

        {sections.map((s) => (
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
  depositBtn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  depositText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },

  balanceBlock: { paddingHorizontal: 16, paddingTop: 20 },
  balanceLabel: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500' },
  balanceValue: { fontSize: 38, lineHeight: 46, fontFamily: 'Inter-700', fontWeight: '700', marginTop: 2 },
  pnl: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 2 },
  availRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  availLabel: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500' },
  availValue: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600' },
  balanceActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  balanceBtn: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  balanceBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },

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
