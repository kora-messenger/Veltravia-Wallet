/**
 * "Pay with" (Trust recording, 3rd frame of the ticket flow).
 *
 * Back arrow + search bar; with no crypto the list shows the empty state
 * ("No crypto yet" / "Please fund your wallet to start trading") and, under
 * "Fund wallet with", the fiat currencies (NGN / USD / EUR / GBP).
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon, SearchIcon, ChevronRight } from '../components/icons';
import { showToast } from '../components/Toast';
import { FONT } from '../theme/typography';
import { FUND_CURRENCIES } from '../services/perpsTrade';

export default function PerpsPayWithScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [q, setQ] = useState('');
  const chipBg = dark ? '#1E2133' : '#EEEDF0';
  const pageBg = dark ? theme.background : '#FCFCFC';

  const currencies = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? FUND_CURRENCIES.filter((c) => c.code.toLowerCase().includes(t) || c.name.toLowerCase().includes(t)) : FUND_CURRENCIES;
  }, [q]);

  return (
    <View style={[styles.root, { backgroundColor: pageBg, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={12} onPress={() => navigation.goBack()} style={[styles.circle, { backgroundColor: chipBg }]}>
          <BackIcon size={22} color={theme.ink} />
        </Pressable>
        <View style={[styles.search, { backgroundColor: chipBg }]}>
          <SearchIcon size={20} color={theme.inkMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search"
            placeholderTextColor={theme.inkMuted}
            style={[styles.input, { color: theme.ink }]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.ink }]}>No crypto yet</Text>
          <Text style={[styles.emptyBody, { color: theme.inkMuted }]}>Please fund your wallet to start trading</Text>
        </View>

        <Text style={[styles.section, { color: theme.inkMuted }]}>Fund wallet with</Text>
        {currencies.map((c) => (
          <Pressable
            key={c.code}
            accessibilityLabel={`Fund with ${c.code}`}
            onPress={() => showToast(`Buying with ${c.code} is coming soon`, { kind: 'info' })}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? (dark ? '#161A28' : '#F1F1F4') : 'transparent' }]}
          >
            <View style={[styles.flag, { backgroundColor: chipBg }]}>
              <Text style={[styles.flagText, { color: theme.ink }]}>{c.code}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: theme.ink }]}>{c.code}</Text>
              <Text style={[styles.rowSub, { color: theme.inkMuted }]}>{c.name}</Text>
            </View>
            <ChevronRight size={18} color={theme.inkMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  input: { flex: 1, fontFamily: FONT.regular, fontSize: 16, padding: 0 },
  empty: { alignItems: 'center', paddingTop: 72, paddingBottom: 56, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FONT.semiBold, fontSize: 20, lineHeight: 26, marginBottom: 6 },
  emptyBody: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  section: { fontFamily: FONT.medium, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 14 },
  flag: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  flagText: { fontFamily: FONT.semiBold, fontSize: 12 },
  rowTitle: { fontFamily: FONT.semiBold, fontSize: 17, lineHeight: 22 },
  rowSub: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 19 },
});
