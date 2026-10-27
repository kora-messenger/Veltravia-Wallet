/**
 * Veltravia Wallet — Manage crypto (Trust parity).
 * Back arrow, centered title, "+" (custom token) top-right, search,
 * a network chip strip (All + networks) and the asset list with a
 * toggle per row. Toggles persist in the encrypted settings store and
 * drive what the Tokens screen shows.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon, PlusIcon, BrandTile, COIN_ICONS, NoResultsIllustration } from '../components/icons';
import { ASSETS, NETWORKS, DEFAULT_ENABLED, assetKey, type CatalogAsset } from '../data/assetCatalog';
import type { CustomToken, CustomNetwork } from '../data/customAssets';
import { readSettings, writeSettings } from '../core/storage/secureStorage';
import SearchField from '../components/SearchField';
import { MOCK_HOLDINGS } from '../services/portfolio';

const NATIVE_LOGOS: Record<string, string> = { BTC: 'BTC', ETH: 'ETH', BNB: 'BNB', SOL: 'SOL', MATIC: 'MATIC', USDT: 'USDT' };

function AssetLogo({ a, size = 48 }: { a: CatalogAsset; size?: number }) {
  const Coin = NATIVE_LOGOS[a.symbol] ? COIN_ICONS[a.symbol] : undefined;
  if (Coin) return <Coin size={size} />;
  const dark = ['#14151F', '#0B0B0B', '#2E3148', '#2D374B', '#0033AD', '#E84142', '#E8112D', '#8247E5', '#C2A633', '#FF0420'].includes(a.color);
  return <BrandTile size={size} color={a.color} mark={a.symbol[0]} lightMark={dark} />;
}

export default function ManageCryptoScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<string>('all');
  const [enabled, setEnabled] = useState<string[]>(DEFAULT_ENABLED);
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);
  const [customNets, setCustomNets] = useState<CustomNetwork[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      (async () => {
        const st = await readSettings();
        if (!alive) return;
        setCustomTokens(Array.isArray(st.customTokens) ? st.customTokens : []);
        setCustomNets(Array.isArray(st.customNetworks) ? st.customNetworks : []);
      })();
      return () => { alive = false; };
    }, []),
  );

  // Custom tokens join the catalog as always-listed assets (enabled on import).
  const allAssets = useMemo<CatalogAsset[]>(() => {
    const netName = (id: string) =>
      NETWORKS.find((n) => n.id === id)?.name ?? customNets.find((n) => n.id === id)?.name ?? id;
    const extra: CatalogAsset[] = customTokens.map((t) => ({
      symbol: t.symbol, name: netName(t.network), fullName: t.name, network: t.network, color: '#6C63FF',
    }));
    return [...ASSETS, ...extra];
  }, [customTokens, customNets]);

  useEffect(() => {
    (async () => {
      const st = await readSettings();
      if (Array.isArray(st.enabledAssets)) {
        setEnabled(st.enabledAssets);
      } else {
        // First visit: anything the user already holds starts ON, plus Trust's BTC/ETH defaults.
        const held = ASSETS.filter((a) => MOCK_HOLDINGS.some((h) => h.symbol === a.symbol)).map(assetKey);
        setEnabled(Array.from(new Set([...DEFAULT_ENABLED, ...held])));
      }
    })();
  }, []);

  const toggle = async (a: CatalogAsset, on: boolean) => {
    const k = assetKey(a);
    const next = on ? [...enabled, k] : enabled.filter((x) => x !== k);
    setEnabled(next);
    await writeSettings({ enabledAssets: next });
  };

  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const inChip = allAssets.filter((a) => chip === 'all' || a.network === chip);
    const az = [...inChip].sort(
      (x, y) => x.symbol.localeCompare(y.symbol) || x.name.localeCompare(y.name),
    );
    if (!q) {
      // No query: enabled assets pinned on top, then the A-Z directory.
      const on = az.filter((a) => enabled.includes(assetKey(a)));
      const off = az.filter((a) => !enabled.includes(assetKey(a)));
      return [...on, ...off];
    }
    // Query: symbol-prefix matches first (the "jump to J" feel), then any other
    // symbol/name/full-name contains-match, each group kept A-Z.
    const prefix = az.filter((a) => a.symbol.toLowerCase().startsWith(q));
    const rest = az.filter(
      (a) =>
        !a.symbol.toLowerCase().startsWith(q) &&
        (a.symbol.toLowerCase().includes(q) ||
          a.fullName.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q)),
    );
    return [...prefix, ...rest];
  }, [chip, q, enabled, allAssets]);

  const chipBorder = theme.brand;
  const chips = [{ id: 'all', name: 'All' }, ...NETWORKS.slice(0, 9)];

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <BackIcon size={24} color={theme.inkMuted} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Manage crypto</Text>
        <Pressable hitSlop={12} onPress={() => navigation.navigate('ImportCrypto')}>
          <PlusIcon size={24} color={theme.inkMuted} />
        </Pressable>
      </View>

      <SearchField value={query} onChangeText={setQuery} style={{ marginHorizontal: 16, marginBottom: 14 }} />

      {/* network chip strip */}
      <View style={{ height: 64 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips.map((c) => {
            const active = chip === c.id;
            const net = NETWORKS.find((n) => n.id === c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => setChip(c.id)}
                style={[styles.chip, active && { borderColor: chipBorder, borderWidth: 2 }]}
              >
                {c.id === 'all' ? (
                  <Text style={[styles.chipAll, { color: active ? chipBorder : theme.ink }]}>All</Text>
                ) : (
                  <BrandTile size={44} round={false} color={net!.color} mark={net!.mark} lightMark={net!.dark || net!.color !== '#CCFF00' && net!.color !== '#FCFF52'} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {rows.length > 0 ? (
        <FlatList
          data={rows}
          keyExtractor={(a) => assetKey(a)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
          ListFooterComponent={
            // Trust parity: after the whole list, the escape hatch to import.
            <Pressable
              style={({ pressed }) => [styles.importFooter, pressed && { opacity: 0.6 }]}
              onPress={() => navigation.navigate('ImportCrypto')}
            >
              <Text style={styles.importFooterText}>Didn't see your crypto? Import</Text>
            </Pressable>
          }
          renderItem={({ item: a }) => {
            const on = enabled.includes(assetKey(a));
            return (
              <View style={styles.row}>
                <AssetLogo a={a} />
                <View style={{ flex: 1 }}>
                  <View style={styles.titleLine}>
                    <Text style={[styles.symbol, { color: theme.ink }]}>{a.symbol}</Text>
                    <View style={[styles.netChip, { backgroundColor: theme.mode === 'dark' ? '#1D2133' : '#F4F4F6' }]}>
                      <Text style={[styles.netChipText, { color: theme.ink }]} numberOfLines={1}>{a.name}</Text>
                    </View>
                  </View>
                  <Text style={[styles.fullName, { color: theme.inkMuted }]}>{a.fullName}</Text>
                </View>
                <Switch
                  value={on}
                  onValueChange={(v) => toggle(a, v)}
                  trackColor={{ true: theme.brand, false: theme.mode === 'dark' ? 'rgba(255,255,255,0.15)' : '#D9DAE0' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            );
          }}
        />
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
  headerTitle: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  chips: { paddingHorizontal: 16, gap: 12, alignItems: 'center' },
  chip: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  chipAll: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 14 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbol: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  netChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, maxWidth: 170 },
  importFooter: { alignItems: 'center', paddingVertical: 22, marginTop: 6 },
  importFooterText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', color: '#3030D0' },
  netChipText: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500' },
  fullName: { fontSize: 15, fontFamily: 'Inter-400', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 18 },
});
