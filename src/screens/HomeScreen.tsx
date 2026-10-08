/**
 * Veltravia Wallet — Home screen (matches the approved mockup 1:1).
 *
 * Top → bottom:
 *   header   : V mark + "Veltravia Wallet" · bell · avatar
 *   card     : purple→blue gradient, "Total Balance" + eye toggle,
 *              big USD value, ≈ NGN, white sparkline bottom-right
 *   actions  : Send · Receive · Swap · Buy (individually tinted tiles)
 *   assets   : "Your Assets" + "See All >", flat rows with coin logos,
 *              price on the right, ▲ change % in green
 *
 * Data is typed mock data until Phase 2 (api.prices() + balances()).
 * The balance-hide toggle is real and already works.
 */

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
  ShieldCheckIcon,
  CloseIcon,
  DashSmall,
  COIN_ICONS,
} from '../components/icons';

// -- Typed mock data (replaced by api.prices() + api.balances() in Phase 2)
const PORTFOLIO_SERIES = [4, 5, 4.6, 6, 5.4, 7, 6.2, 8, 7.4, 9.2, 8.6, 10.8, 10, 12.5];

interface Asset {
  symbol: string;
  name: string;
  fiat: number;
  change: number;
}
const MOCK_ASSETS: Asset[] = [
  { symbol: 'ETH', name: 'Ethereum', fiat: 420.13, change: 0.8 },
  { symbol: 'BNB', name: 'BNB', fiat: 262.45, change: 2.4 },
  { symbol: 'USDT', name: 'Tether', fiat: 228.08, change: 0.0 },
  { symbol: 'MATIC', name: 'Polygon', fiat: 148.32, change: 1.2 },
  { symbol: 'SOL', name: 'Solana', fiat: 89.44, change: 3.6 },
];

const TOTAL_USD = 1248.42;
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
  const { activeWallet, wallets } = useWallets();

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
        {/* ---------- Balance card ---------- */}
        <LinearGradient
          colors={[theme.cardGradient[0], theme.cardGradient[1]]}
          start={{ x: 0, y: 0.15 }}
          end={{ x: 1, y: 0.85 }}
          style={[styles.card, { width: cardW }]}
        >
          <View style={styles.cardLabelRow}>
            <Text style={styles.cardLabel}>Total Balance</Text>
            <Pressable hitSlop={10} onPress={() => setHidden((h) => !h)}>
              <EyeIcon size={16} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>
          <Text style={styles.cardValue}>{hidden ? '$••••••' : `$${fmt(TOTAL_USD)}`}</Text>
          <Text style={styles.cardSub}>
            ≈ ₦{hidden ? mask : fmt(TOTAL_USD * NGN_RATE)}
          </Text>
          <View style={styles.sparkWrap} pointerEvents="none">
            <Sparkline data={PORTFOLIO_SERIES} width={cardW * 0.42} height={58} />
          </View>
        </LinearGradient>

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
            <Pressable
              style={[styles.backupBtn, { backgroundColor: theme.brandGradient[0] }]}
              onPress={() =>
                Alert.alert(
                  'Back up your wallet',
                  'The secure backup flow (seed phrase reveal and verification) arrives with the Wallet Core integration. Until then, keep your device safe.',
                  [{ text: 'Got it' }],
                )
              }
            >
              <Text style={styles.backupBtnText}>Back up</Text>
            </Pressable>
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

        {/* ---------- Assets ---------- */}
        <View style={styles.assetsHeader}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Your Assets</Text>
          <Pressable style={styles.seeAllRow} onPress={() => {}} hitSlop={8}>
            <Text style={[styles.seeAll, { color: theme.inkMuted }]}>See All</Text>
            <ChevronRight size={14} color={theme.inkMuted} />
          </Pressable>
        </View>

        {MOCK_ASSETS.map((a) => {
          const Coin = COIN_ICONS[a.symbol];
          const flat = a.change === 0;
          const color = flat ? theme.inkMuted : theme.positive;
          return (
            <Pressable
              key={a.symbol}
              style={({ pressed }) => [styles.assetRow, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => {}}
            >
              {Coin ? <Coin size={40} /> : <View style={styles.coinFallback} />}
              <View style={styles.assetMain}>
                <Text style={[styles.assetName, { color: theme.ink }]}>{a.name}</Text>
                <Text style={[styles.assetSym, { color: theme.inkMuted }]}>
                  {a.symbol}
                </Text>
              </View>
              <View style={styles.assetRight}>
                <Text style={[styles.assetFiat, { color: theme.ink }]}>
                  {hidden ? '$••••' : `$${fmt(a.fiat)}`}
                </Text>
                <View style={styles.changeRow}>
                  {flat ? (
                    <DashSmall size={12} color={color} />
                  ) : (
                    <ArrowUpSmall size={12} color={color} />
                  )}
                  <Text style={[styles.changeText, { color }]}>{a.change.toFixed(1)}%</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
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
              onPress={() => {}}
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
  content: { paddingTop: 72, paddingBottom: 120 },

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
  brand: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
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
  backupTitle: { fontSize: 14, fontWeight: '700' },
  backupSub: { fontSize: 12, lineHeight: 16 },
  backupBtn: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  backupBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  card: {
    alignSelf: 'center',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    minHeight: 124,
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500' },
  cardValue: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  cardSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 4, fontWeight: '500' },
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
  actionLabel: { fontSize: 12, fontWeight: '600' },

  assetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: { fontSize: 13, fontWeight: '500' },

  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 14,
  },
  coinFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#888' },
  assetMain: { flex: 1 },
  assetName: { fontSize: 16, fontWeight: '700' },
  assetSym: { fontSize: 13, marginTop: 2 },
  assetRight: { alignItems: 'flex-end' },
  assetFiat: { fontSize: 16, fontWeight: '700' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  changeText: { fontSize: 13, fontWeight: '600' },
});
