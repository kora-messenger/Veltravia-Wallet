/**
 * Veltravia Wallet — Tokens (Trust-style asset list).
 * Opened from Home's Tokens section (row tap, header, or "View all").
 * The floating pill stays mounted below (real tab), like Trust.
 * Filter icon opens the Trust-style "Manage" sheet: Dust cleaner,
 * Manage crypto (per-token visibility, persisted), Hide assets <$0.01.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon, FilterLinesIcon, ChevronRight, COIN_ICONS } from '../components/icons';
import { MOCK_HOLDINGS } from '../services/portfolio';
import { readSettings, writeSettings } from '../core/storage/secureStorage';
import AppModal from '../components/AppModal';
import SearchField from '../components/SearchField';

const TOKEN_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', USDT: 'Tether', MATIC: 'Polygon', SOL: 'Solana',
};
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TokensScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSub, setManageSub] = useState<null>(null);
  const [hideDust, setHideDust] = useState(false);
  const [enabledAssets, setEnabledAssets] = useState<string[] | null>(null);

  // Re-read on focus so toggles made in Manage crypto apply immediately.
  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      (async () => {
        const st = await readSettings();
        if (!alive) return;
        if (typeof st.hideDust === 'boolean') setHideDust(st.hideDust);
        setEnabledAssets(Array.isArray(st.enabledAssets) ? st.enabledAssets : null);
      })();
      return () => { alive = false; };
    }, []),
  );

  const persistDust = async (on: boolean) => {
    setHideDust(on);
    await writeSettings({ hideDust: on });
  };
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_HOLDINGS.filter((h) => {
      const value = h.amount * h.price;
      // enabledAssets (Manage crypto) wins; before the user ever touches it, show everything held.
      if (enabledAssets && !enabledAssets.some((k) => k.startsWith(`${h.symbol}:`))) return false;
      if (hideDust && value < 0.01) return false;
      return !q || h.symbol.toLowerCase().includes(q) || (TOKEN_NAMES[h.symbol] ?? '').toLowerCase().includes(q);
    });
  }, [query, hideDust, enabledAssets]);


  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Tokens</Text>
        <Pressable
          hitSlop={12}
          style={[styles.filterBtn, manageOpen && { backgroundColor: theme.mode === 'dark' ? '#1D2133' : '#EFEFF1' }]}
          onPress={() => setManageOpen(true)}
        >
          <FilterLinesIcon size={24} color={theme.ink} />
        </Pressable>
      </View>

      <SearchField value={query} onChangeText={setQuery} height={40} style={{ marginHorizontal: 16, marginBottom: 8 }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {rows.map((h) => {
          const Coin = COIN_ICONS[h.symbol] ?? COIN_ICONS.ETH;
          const value = h.amount * h.price;
          return (
            <Pressable
              key={h.symbol}
              style={({ pressed }) => [styles.tokenRow, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => navigation.navigate('BalanceDetails')}
            >
              <Coin size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.tokenName, { color: theme.ink }]}>{TOKEN_NAMES[h.symbol] ?? h.symbol}</Text>
                <Text style={[styles.tokenAmount, { color: theme.inkMuted }]}>
                  {h.amount < 1 ? h.amount.toFixed(4) : h.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} {h.symbol}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.tokenName, { color: theme.ink }]}>${fmt(value)}</Text>
                <Text style={[styles.tokenAmount, { color: h.change24h >= 0 ? '#16A34A' : '#DC2626' }]}>
                  {h.change24h >= 0 ? '+' : ''}{h.change24h.toFixed(1)}%
                </Text>
              </View>
            </Pressable>
          );
        })}
        {rows.length === 0 && (
          <Text style={[styles.empty, { color: theme.inkMuted }]}>No tokens match "{query}"</Text>
        )}
      </ScrollView>

      {/* ---------- Manage sheet (Trust-style) ---------- */}
      <AppModal visible={manageOpen && manageSub === null} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setManageOpen(false)}>
        <Pressable style={[styles.dim, { backgroundColor: 'rgba(0,0,0,0.35)' }]} onPress={() => setManageOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: isDark ? theme.surfaceAlt : '#FFFFFF' }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dragHandle} />
            <Text style={[styles.sheetTitleCenter, { color: theme.ink }]}>Manage</Text>

            <Pressable style={styles.manageRow} onPress={() => { setManageOpen(false); navigation.navigate('SelectNetwork'); }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.manageRowTitle, { color: theme.ink }]}>Dust cleaner</Text>
                <Text style={[styles.manageRowSub, { color: theme.inkMuted }]}>Convert Dust to Native Token</Text>
              </View>
              <ChevronRight size={20} color={theme.inkMuted} />
            </Pressable>

            <Pressable style={styles.manageRow} onPress={() => { setManageOpen(false); navigation.navigate('ManageCrypto'); }}>
              <Text style={[styles.manageRowTitle, { color: theme.ink }]}>Manage crypto</Text>
              <ChevronRight size={20} color={theme.inkMuted} />
            </Pressable>

            <View style={styles.manageRow}>
              <Text style={[styles.manageRowTitle, { color: theme.ink }]}>Hide assets &lt;$0.01 USD</Text>
              <Switch
                value={hideDust}
                onValueChange={persistDust}
                trackColor={{ true: theme.brand, false: theme.mode === 'dark' ? 'rgba(255,255,255,0.15)' : '#E0E0E0' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Pressable>
        </Pressable>
      </AppModal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
  filterBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 140 },
  tokenRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  tokenName: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  tokenAmount: { fontSize: 13, fontFamily: 'Inter-400', marginTop: 2 },
  empty: { textAlign: 'center', paddingTop: 40, fontSize: 14, fontFamily: 'Inter-400' },
  dim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 48 },
  dragHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(120,124,140,0.4)', marginBottom: 14 },
  sheetTitleCenter: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  manageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  manageRowTitle: { fontSize: 15, fontFamily: 'Inter-500', fontWeight: '500' },
  manageRowSub: { fontSize: 12, fontFamily: 'Inter-400', marginTop: 2 },
  dustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
});
