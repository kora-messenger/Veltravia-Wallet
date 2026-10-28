/**
 * Order book ladder shown in place of the chart (Trust recording, Oct 28).
 *
 *   Bid            Price  |  Price            Ask
 *   [green bar ......307,192 81,420 | 81,460 20,271 ....... red bar]
 *   ... 19 rows, far levels on top, the touch at the bottom (a funnel)
 *   USD v                                    Group by 1 v
 *   [B 34% ============ green | red ============ 66% S]
 *
 * Bid bars hug the centre and grow LEFT; ask bars start at the centre and grow
 * RIGHT. Sizes are left-aligned (bids) / right-aligned (asks) over the bars.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronDownIcon } from './icons';
import { FONT } from '../theme/typography';
import {
  type OrderBook, type BookCurrency, type BookGroup, ladderRows, barFractions, buySellRatio,
  formatBookSize, formatBookPrice,
} from '../services/orderBook';

const GREEN = '#0F884D';
const RED = '#D63232';

export const ROW_H = 34.5;

interface Props {
  book: OrderBook;
  currency: BookCurrency;
  group: BookGroup;
  dark: boolean;
  ink: string;
  inkMuted: string;
  onOpenSettings: () => void;
}

export default function OrderBookView({ book, currency, group, dark, ink, inkMuted, onOpenSettings }: Props) {
  const rows = ladderRows(book, currency);
  const frac = barFractions(rows);
  const ratio = buySellRatio(book, currency);
  const bidBar = dark ? 'rgba(15,136,77,0.28)' : '#D6E9E0';
  const askBar = dark ? 'rgba(214,50,50,0.26)' : '#F5D8D8';
  const bidTxt = dark ? '#3FD08A' : GREEN;
  const askTxt = dark ? '#FF7A7A' : RED;

  return (
    <View style={styles.root} testID="orderBook">
      <View style={styles.headRow}>
        <Text style={[styles.head, { color: inkMuted, textAlign: 'left' }]}>Bid</Text>
        <Text style={[styles.head, { color: inkMuted, textAlign: 'center' }]}>Price</Text>
        <Text style={[styles.head, { color: inkMuted, textAlign: 'right' }]}>Ask</Text>
      </View>

      <View testID="bookRows">
        {rows.map((r, i) => (
          <View key={`${r.bid.price}-${r.ask.price}`} style={styles.row}>
            <View style={styles.half}>
              <View style={[styles.bar, styles.bidBar, { width: `${Math.max(2, frac[i].bid * 100)}%`, backgroundColor: bidBar }]} />
              <Text style={[styles.size, { color: ink }]}>{formatBookSize(r.bidV, currency)}</Text>
              <Text style={[styles.price, { color: bidTxt }]}>{formatBookPrice(r.bid.price, group)}</Text>
            </View>
            <View style={{ width: 6 }} />
            <View style={styles.half}>
              <View style={[styles.bar, styles.askBar, { width: `${Math.max(2, frac[i].ask * 100)}%`, backgroundColor: askBar }]} />
              <Text style={[styles.price, { color: askTxt }]}>{formatBookPrice(r.ask.price, group)}</Text>
              <Text style={[styles.size, { color: ink, textAlign: 'right' }]}>{formatBookSize(r.askV, currency)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footRow}>
        <Pressable accessibilityLabel="Display currency" onPress={onOpenSettings} style={styles.footBtn} hitSlop={8}>
          <Text style={[styles.footText, { color: inkMuted }]}>{currency}</Text>
          <ChevronDownIcon size={13} color={inkMuted} />
        </Pressable>
        <Pressable accessibilityLabel="Group by" onPress={onOpenSettings} style={styles.footBtn} hitSlop={8}>
          <Text style={[styles.footText, { color: inkMuted }]}>Group by </Text>
          <Text style={[styles.footText, { color: ink, fontFamily: FONT.semiBold }]}>{String(group)}</Text>
          <ChevronDownIcon size={13} color={inkMuted} />
        </Pressable>
      </View>

      <View style={styles.ratioRow} testID="ratioBar">
        <View style={[styles.pill, { backgroundColor: GREEN }]}><Text style={styles.pillText}>B</Text></View>
        <Text style={[styles.pct, { color: bidTxt }]}>{`${ratio.buy}%`}</Text>
        <View style={styles.ratioTrack}>
          <View style={{ flex: ratio.buy, backgroundColor: bidBar, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }} />
          <View style={{ flex: ratio.sell, backgroundColor: askBar, borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />
        </View>
        <Text style={[styles.pct, { color: askTxt }]}>{`${ratio.sell}%`}</Text>
        <View style={[styles.pill, { backgroundColor: RED }]}><Text style={styles.pillText}>S</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: 20 },
  headRow: { flexDirection: 'row', height: 28, alignItems: 'center' },
  head: { flex: 1, fontFamily: FONT.regular, fontSize: 14 },
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center' },
  half: { flex: 1, height: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  bar: { position: 'absolute', top: 0, bottom: 0 },
  bidBar: { right: 0, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  askBar: { left: 0, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  size: { fontFamily: FONT.regular, fontSize: 14, minWidth: 64 },
  price: { fontFamily: FONT.medium, fontSize: 14 },
  footRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 },
  footBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  footText: { fontFamily: FONT.medium, fontSize: 14 },
  ratioRow: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26 },
  pill: { width: 22, height: 22, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  pillText: { color: '#FFFFFF', fontFamily: FONT.bold, fontSize: 12 },
  pct: { fontFamily: FONT.semiBold, fontSize: 13, minWidth: 34 },
  ratioTrack: { flex: 1, height: 16, flexDirection: 'row', gap: 3 },
});
