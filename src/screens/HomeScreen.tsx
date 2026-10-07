/**
 * Veltravia Wallet — Home screen (per approved mockup).
 *
 * Layout: header (brand + bell + avatar), gradient balance card with fiat
 * toggle and sparkline, quick action row (Send, Receive, Swap, Buy),
 * "Your Assets" list with 24h change, See All link.
 *
 * Phase 1: structure + theming wired; data hooks stubbed with typed mocks.
 * Phase 2 replaces mocks with the api service + wallet accounts.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

// -- Typed mock data (replaced by api.prices() + api.balances() in Phase 2)
const MOCK_ASSETS = [
  { symbol: 'ETH', chain: 'Ethereum', amount: '0.0421', fiat: 142.86, change: 2.41 },
  { symbol: 'BNB', chain: 'BNB Chain', amount: '0.3100', fiat: 178.20, change: -0.82 },
  { symbol: 'POL', chain: 'Polygon', amount: '120.50', fiat: 44.17, change: 5.13 },
];

export default function HomeScreen() {
  const { theme } = useTheme();

  const quickActions = [
    { label: 'Send', action: () => {} },
    { label: 'Receive', action: () => {} },
    { label: 'Swap', action: () => {} },
    { label: 'Buy', action: () => {} },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      {/* RN 0.87 is edge-to-edge by default; only the bar style is ours. */}
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.brand, { color: theme.ink }]}>Veltravia</Text>
          <View style={styles.headerRight}>
            <Pressable hitSlop={12} onPress={() => {}}>
              <Text style={[styles.bell, { color: theme.ink }]}>🔔</Text>
            </Pressable>
            <Pressable hitSlop={12} onPress={() => {}}>
              <View style={[styles.avatar, { backgroundColor: theme.brand }]}>
                <Text style={styles.avatarText}>V</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Balance card */}
        <LinearGradient
          colors={[theme.brandGradient[0], theme.brandGradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Total Balance · USD</Text>
          <Text style={styles.balanceValue}>$365.23</Text>
          <Text style={styles.balanceSub}>≈ ₦547,845.00</Text>
          {/* Sparkline lands here in Phase 2 (react-native-svg chart) */}
          <View style={styles.sparklinePlaceholder} />
        </LinearGradient>

        {/* Quick actions */}
        <View style={styles.actions}>
          {quickActions.map((a) => (
            <Pressable
              key={a.label}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: theme.surface, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={a.action}
            >
              <Text style={styles.actionEmoji}>↑↓⇄＋</Text>
              <Text style={[styles.actionLabel, { color: theme.ink }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Assets */}
        <View style={styles.assetsHeader}>
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>Your Assets</Text>
          <Pressable onPress={() => {}}>
            <Text style={[styles.seeAll, { color: theme.brand }]}>See All</Text>
          </Pressable>
        </View>

        {MOCK_ASSETS.map((asset) => (
          <View
            key={asset.symbol}
            style={[styles.assetRow, { backgroundColor: theme.surface }]}
          >
            <View style={[styles.assetIcon, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={styles.assetIconText}>{asset.symbol[0]}</Text>
            </View>
            <View style={styles.assetMain}>
              <Text style={[styles.assetName, { color: theme.ink }]}>{asset.symbol}</Text>
              <Text style={[styles.assetChain, { color: theme.inkMuted }]}>{asset.chain}</Text>
            </View>
            <View style={styles.assetRight}>
              <Text style={[styles.assetFiat, { color: theme.ink }]}>
                ${asset.fiat.toFixed(2)}
              </Text>
              <Text
                style={[
                  styles.assetChange,
                  { color: asset.change >= 0 ? theme.positive : theme.negative },
                ]}
              >
                {asset.change >= 0 ? '+' : ''}
                {asset.change.toFixed(2)}%
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brand: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bell: { fontSize: 20 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  balanceCard: { borderRadius: 20, padding: 24, marginBottom: 24 },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 6 },
  balanceValue: { color: '#fff', fontSize: 38, fontWeight: '800' },
  balanceSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  sparklinePlaceholder: { height: 36 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  actionBtn: {
    flex: 1, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', gap: 6,
  },
  actionEmoji: { fontSize: 16 },
  actionLabel: { fontSize: 12, fontWeight: '600' },
  assetsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  seeAll: { fontSize: 13, fontWeight: '600' },
  assetRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 14, marginBottom: 10, gap: 12,
  },
  assetIcon: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
  },
  assetIconText: { fontSize: 15, fontWeight: '700' },
  assetMain: { flex: 1 },
  assetName: { fontSize: 15, fontWeight: '600' },
  assetChain: { fontSize: 12, marginTop: 2 },
  assetRight: { alignItems: 'flex-end' },
  assetFiat: { fontSize: 15, fontWeight: '600' },
  assetChange: { fontSize: 12, marginTop: 2 },
});
