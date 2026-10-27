/**
 * Veltravia Wallet — Select network (Dust cleaner entry).
 * Mirrors Trust: back arrow + centered title, search pill, "A-Z networks"
 * list with radio circles. The search shows a "Cancel" action only while
 * focused; Cancel clears, blurs and hides itself. No matches -> illustrated
 * "No results found".
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import {
  BackIcon, NoResultsIllustration,
  CoinEth, CoinBnb, CoinSolana, NetArbitrum, NetBase, NetOptimism, BrandTile, GlobeIcon,
} from '../components/icons';
import { NETWORKS } from '../data/assetCatalog';
import { showToast } from '../components/Toast';
import SearchField from '../components/SearchField';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  ethereum: CoinEth, bsc: CoinBnb, solana: CoinSolana,
  arbitrum: NetArbitrum, base: NetBase, optimism: NetOptimism,
};
const POPULAR = ['bitcoin', 'ethereum', 'solana', 'bsc', 'tron', 'arbitrum', 'base', 'robinhood'];
const MARK_LIGHT = (c: string) => c !== '#CCFF00' && c !== '#FCFF52';

function NetLogo({ id, size = 54 }: { id: string; size?: number }) {
  const Icon = ICONS[id];
  if (Icon) return <Icon size={size} />;
  const n = NETWORKS.find((x) => x.id === id)!;
  return <BrandTile size={size} round={false} color={n.color} mark={n.mark} lightMark={MARK_LIGHT(n.color)} />;
}

export default function SelectNetworkScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState<string>('all');

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () => NETWORKS.filter((n) => !q || n.name.toLowerCase().includes(q)),
    [q],
  );
  const popular = rows.filter((n) => POPULAR.includes(n.id)).sort((a, b) => POPULAR.indexOf(a.id) - POPULAR.indexOf(b.id));
  const others = rows.filter((n) => !POPULAR.includes(n.id)).sort((a, b) => a.name.localeCompare(b.name));
  const showAll = !q || 'all networks'.includes(q);

  const cancel = () => {
    setQuery('');
    Keyboard.dismiss();
    setFocused(false);
  };

  const pick = (id: string, name: string) => {
    setSelected(id);
    // Dust conversion needs the signing bridge; be honest about it.
    showToast(`${name} selected. Conversion ships with the signing bridge`, { kind: 'info' });
  };

  const renderNet = (n: { id: string; name: string }) => (
    <Pressable
      key={n.id}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      onPress={() => pick(n.id, n.name)}
    >
      <NetLogo id={n.id} />
      <Text style={[styles.rowName, { color: theme.ink }]}>{n.name}</Text>
      <View style={[styles.radio, { borderColor: selected === n.id ? theme.brand : theme.inkMuted }]}>
        {selected === n.id && <View style={[styles.radioDot, { backgroundColor: theme.brand }]} />}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <BackIcon size={24} color={theme.inkMuted} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Select network</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* search row: pill + Cancel (only while focused) */}
      <View style={styles.searchRow}>
        <SearchField
          style={{ flex: 1 }}
          placeholder="Search for network"
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="search"
        />
        {(focused || query.length > 0) && (
          <Pressable hitSlop={10} onPress={cancel}>
            <Text style={[styles.cancel, { color: theme.brand }]}>Cancel</Text>
          </Pressable>
        )}
      </View>

      {showAll || rows.length > 0 ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {showAll && (
            <Pressable style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]} onPress={() => pick('all', 'All networks')}>
              <View style={[styles.globeTile, { backgroundColor: theme.mode === 'dark' ? '#1D2133' : '#EFEFF1' }]}>
                <GlobeIcon size={26} color={theme.inkMuted} />
              </View>
              <Text style={[styles.rowName, { color: theme.ink }]}>All networks</Text>
              <View style={[styles.radio, { borderColor: selected === 'all' ? theme.brand : theme.inkMuted }]}>
                {selected === 'all' && <View style={[styles.radioDot, { backgroundColor: theme.brand }]} />}
              </View>
            </Pressable>
          )}
          {popular.length > 0 && <Text style={[styles.sectionLabel, { color: theme.inkMuted }]}>Popular networks</Text>}
          {popular.map(renderNet)}
          {others.length > 0 && <Text style={[styles.sectionLabel, { color: theme.inkMuted }]}>A-Z networks</Text>}
          {others.map(renderNet)}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <NoResultsIllustration size={130} />
          <Text style={[styles.emptyText, { color: theme.inkMuted }]}>No results found</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, marginBottom: 10 },
  cancel: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingBottom: 140 },
  sectionLabel: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 10, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 16 },
  rowName: { flex: 1, fontSize: 17, fontFamily: 'Inter-600', fontWeight: '600' },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  globeTile: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 14, height: 14, borderRadius: 7 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 90 },
  emptyText: { fontSize: 16, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 18 },
});
