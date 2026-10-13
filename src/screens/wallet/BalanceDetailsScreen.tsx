/**
 * Veltravia Wallet — Balance Details screen.
 *
 * Opened by tapping the balance card on Home. Shows the total portfolio
 * value over time (all holdings combined, not a single coin) with
 * 7D / 30D / 90D / 1Y ranges, plus high/low/change stats and the
 * best / worst performing asset of the selected range.
 *
 * Data: services/portfolio (mock price walks + holding deltas until the
 * backend serves /v1/history and /v1/balances; the combiner is final).
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { BackIcon, EyeIcon, ArrowUpSmall, ArrowDownSmall, COIN_ICONS } from '../../components/icons';
import PortfolioChart from '../../components/PortfolioChart';
import {
  portfolioSeries,
  performers,
  totalValue,
  change24h,
  RANGE_DAYS,
  RANGES,
  type Range,
} from '../../services/portfolio';

const NGN_RATE = 1559; // placeholder; Phase 2 reads this from the price API

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BalanceDetailsScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<Range>('7D');
  const [hidden, setHidden] = useState(false);

  const series = useMemo(() => portfolioSeries(range), [range]);
  const perf = useMemo(() => performers(range), [range]);
  const total = totalValue();
  const c24 = change24h();
  const mask = '••••••';

  const up = series.changePct >= 0;
  const chartColor = up ? theme.positive : theme.negative;
  const best = perf[0];
  const worst = perf[perf.length - 1];
  const BestCoin = best ? COIN_ICONS[best.symbol] : null;
  const WorstCoin = worst ? COIN_ICONS[worst.symbol] : null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top']}>
      {/* ---------- header ---------- */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.circle, { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.8 : 1 }]}
        >
          <BackIcon size={20} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Balance Details</Text>
        <Pressable
          hitSlop={10}
          onPress={() => setHidden((h) => !h)}
          style={({ pressed }) => [styles.circle, { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.8 : 1 }]}
        >
          <EyeIcon size={18} color={theme.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- value ---------- */}
        <View style={styles.valueWrap}>
          <Text style={[styles.valueLabel, { color: theme.inkMuted }]}>Total Balance</Text>
          <Text style={[styles.value, { color: theme.ink }]}>
            {hidden ? '$••••••' : `$${fmt(total)}`}
          </Text>
          <Text style={[styles.valueSub, { color: theme.inkMuted }]}>
            ≈ ₦{hidden ? mask : fmt(total * NGN_RATE)}
          </Text>
          <View style={styles.changeChip}>
            {up ? <ArrowUpSmall size={13} color={chartColor} /> : <ArrowDownSmall size={13} color={chartColor} />}
            <Text style={[styles.changeText, { color: chartColor }]}>
              {up ? '+' : ''}{series.changePct.toFixed(2)}%
            </Text>
            <Text style={[styles.changeSub, { color: theme.inkMuted }]}>(24h {c24 >= 0 ? '+' : ''}{c24.toFixed(1)}%)</Text>
          </View>
        </View>

        {/* ---------- range chips ---------- */}
        <View style={[styles.chipRow, { backgroundColor: theme.surfaceAlt }]}>
          {RANGES.map((r: Range) => {
            const active = r === range;
            return (
              <Pressable key={r} onPress={() => setRange(r)} style={styles.chipPress}>
                <View
                  style={[
                    styles.chip,
                    { backgroundColor: active ? theme.background : 'transparent' },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? theme.ink : theme.inkMuted },
                      active && styles.chipTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ---------- chart ---------- */}
        <View style={styles.chartWrap}>
          <PortfolioChart
            points={series.points}
            rangeDays={RANGE_DAYS[range]}
            width={width - 32}
            height={190}
            color={chartColor}
          />
        </View>

        {/* ---------- range stats ---------- */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>Change</Text>
            <Text style={[styles.statValue, { color: up ? theme.positive : theme.negative }]}>
              {hidden ? '••••' : `${series.changeUsd >= 0 ? '+' : '-'}$${fmt(Math.abs(series.changeUsd))}`}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>High</Text>
            <Text style={[styles.statValue, { color: theme.ink }]}>
              {hidden ? '••••' : `$${fmt(series.high)}`}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.statLabel, { color: theme.inkMuted }]}>Low</Text>
            <Text style={[styles.statValue, { color: theme.ink }]}>
              {hidden ? '••••' : `$${fmt(series.low)}`}
            </Text>
          </View>
        </View>

        {/* ---------- performers ---------- */}
        <View style={[styles.perfPanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.perfTitle, { color: theme.ink }]}>Best & Worst · {range}</Text>
          {best && (
            <View style={styles.perfRow}>
              {BestCoin ? <BestCoin size={32} /> : null}
              <View style={styles.perfMain}>
                <Text style={[styles.perfName, { color: theme.ink }]}>{best.symbol}</Text>
                <Text style={[styles.perfSub, { color: theme.inkMuted }]}>
                  {best.changePct >= 0 ? '+' : ''}{best.changePct.toFixed(1)}% · {hidden ? '••••' : `${best.contributionUsd >= 0 ? '+' : '-'}$${fmt(Math.abs(best.contributionUsd))}`}
                </Text>
              </View>
              <Text style={[styles.perfTag, { color: theme.positive }]}>Best</Text>
            </View>
          )}
          {worst && worst.symbol !== best?.symbol && (
            <View style={[styles.perfRow, styles.perfRowLast]}>
              {WorstCoin ? <WorstCoin size={32} /> : null}
              <View style={styles.perfMain}>
                <Text style={[styles.perfName, { color: theme.ink }]}>{worst.symbol}</Text>
                <Text style={[styles.perfSub, { color: theme.inkMuted }]}>
                  {worst.changePct >= 0 ? '+' : ''}{worst.changePct.toFixed(1)}% · {hidden ? '••••' : `${worst.contributionUsd >= 0 ? '+' : '-'}$${fmt(Math.abs(worst.contributionUsd))}`}
                </Text>
              </View>
              <Text style={[styles.perfTag, { color: theme.negative }]}>Worst</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  circle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700', letterSpacing: -0.3 },

  content: { paddingHorizontal: 16, paddingBottom: 40 },

  valueWrap: { alignItems: 'center', paddingVertical: 12 },
  valueLabel: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500' },
  value: { fontSize: 36, fontFamily: 'Inter-800', fontWeight: '800', letterSpacing: -1, marginTop: 6 },
  valueSub: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 4 },
  changeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  changeText: { fontSize: 14, fontFamily: 'Inter-700', fontWeight: '700' },
  changeSub: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500' },

  chipRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginTop: 8,
  },
  chipPress: { flex: 1 },
  chip: { borderRadius: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
  chipTextActive: { fontFamily: 'Inter-700', fontWeight: '700' },

  chartWrap: { marginTop: 18 },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: 'center' },
  statLabel: { fontSize: 11.5, fontFamily: 'Inter-500', fontWeight: '500' },
  statValue: { fontSize: 14, fontFamily: 'Inter-700', fontWeight: '700', marginTop: 4 },

  perfPanel: { borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 14 },
  perfTitle: { fontSize: 14, fontFamily: 'Inter-700', fontWeight: '700', marginBottom: 10 },
  perfRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  perfRowLast: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  perfMain: { flex: 1 },
  perfName: { fontSize: 14, fontFamily: 'Inter-700', fontWeight: '700' },
  perfSub: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 2 },
  perfTag: { fontSize: 12, fontFamily: 'Inter-700', fontWeight: '700' },
});
