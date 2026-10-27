/**
 * Veltravia Wallet — Perps (Settings > Perps).
 * v1: what perpetual futures are and how trading will work on Veltravia.
 * Trading itself goes live with the Wallet Core signing bridge.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon } from '../components/icons';

export default function PerpsAboutScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  // Pushed from Settings -> back arrow; opened from the bottom bar -> root tab, no arrow.
  const canBack = navigation.canGoBack?.() ?? false;

  const sections: { title: string; body: string }[] = [
    {
      title: 'What a perpetual is',
      body: 'A perpetual (perp) is a futures contract with no expiry date. You open a position on an asset by posting margin, and the position stays open for as long as you want — hours or months.',
    },
    {
      title: 'Long and short',
      body: 'Going long profits when the price rises. Going short profits when the price falls, so you can trade in both directions without owning the coin.',
    },
    {
      title: 'Leverage',
      body: 'Leverage multiplies your exposure. With 10x, a 1% move becomes a 10% gain on your margin. It multiplies losses the same way, so leverage cuts both ways.',
    },
    {
      title: 'Funding rate',
      body: 'Because perps never expire, longs and shorts pay each other a small periodic fee (the funding rate) that keeps the contract price pinned to the real market price.',
    },
    {
      title: 'Liquidation',
      body: 'If the market moves against your position and your remaining margin can no longer cover the loss, the position is closed automatically. Your maximum loss is the margin you posted — never more.',
    },
    {
      title: 'How it will run on Veltravia',
      body: 'Positions will be signed on your device and routed through api.veltraviawallet.com — self-custodial, privacy-first, no accounts. Trading goes live once the Wallet Core signing bridge ships.',
    },
  ];

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        {canBack ? (
          <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
            <BackIcon size={24} color={theme.ink} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Perps</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.badge, { borderColor: theme.brand }]}>
          <Text style={[styles.badgeText, { color: theme.brand }]}>Coming soon</Text>
        </View>
        <Text style={[styles.lede, { color: theme.inkMuted }]}>
          Perpetual futures: trade any listed asset long or short, with leverage, straight from your wallet.
        </Text>
        {sections.map((s) => (
          <View key={s.title} style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.ink }]}>{s.title}</Text>
            <Text style={[styles.cardBody, { color: theme.inkMuted }]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
  content: { padding: 16, paddingBottom: 120 },
  badge: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12 },
  badgeText: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },
  lede: { fontSize: 15, fontFamily: 'Inter-400', lineHeight: 22, marginBottom: 16 },
  card: { borderRadius: 16, padding: 16, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', marginBottom: 6 },
  cardBody: { fontSize: 13, fontFamily: 'Inter-400', lineHeight: 19 },
});
