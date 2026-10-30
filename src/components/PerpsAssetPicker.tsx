/**
 * Veltravia Wallet - Perps asset picker (opened from the Filter sheet's Assets row).
 *
 * Lists the markets the app really supports (PERP_SECTIONS, via
 * supportedAssets()). Nothing is invented: if a pair is not in the Perps lists
 * it is not here. Multi-select with search, a live "n selected" count, Clear,
 * and Done to hand the selection back to the filter sheet.
 *
 * Rendered inside the filter sheet's own Modal (not a second Modal on top of
 * it) so Android's back button and the scrim behave as one surface.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon, SearchIcon, CheckIcon, CloseIcon } from './icons';
import { HyperliquidTile, AsterTile } from './PerpsVenueMarks';
import { FONT } from '../theme/typography';
import { supportedAssets, searchAssets, type PerpsAssetOption, type PerpsProvider } from '../core/perps/activityFilters';

export default function PerpsAssetPicker({
  selected,
  providers,
  onDone,
  onBack,
}: {
  selected: string[];
  /** providers already chosen in the sheet: the list narrows to them */
  providers: PerpsProvider[];
  onDone: (symbols: string[]) => void;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = theme.mode === 'dark';
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>(selected);

  const all = useMemo(() => supportedAssets(), []);
  const rows = useMemo(() => searchAssets(all, query, providers), [all, query, providers]);

  const ink = dark ? '#FFFFFF' : '#080D13';
  const muted = dark ? '#9A9EB5' : '#818685';
  const fill = dark ? '#232640' : '#EFEEF1';

  const toggle = (symbol: string) =>
    setPicked((p) => (p.includes(symbol) ? p.filter((s) => s !== symbol) : [...p, symbol]));

  const renderRow = ({ item }: { item: PerpsAssetOption }) => {
    const on = picked.includes(item.symbol);
    const Mark = item.provider === 'aster' ? AsterTile : HyperliquidTile;
    return (
      <Pressable
        onPress={() => toggle(item.symbol)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${item.symbol}, ${item.provider === 'aster' ? 'Aster' : 'Hyperliquid'}`}
        style={({ pressed }) => [s.row, pressed ? { opacity: 0.7 } : null]}
        testID={`asset-${item.symbol}`}
      >
        <Mark size={32} />
        <View style={{ flex: 1 }}>
          <Text style={[s.sym, { color: ink }]}>{item.symbol}</Text>
          <Text style={[s.sub, { color: muted }]}>{item.provider === 'aster' ? 'Aster' : 'Hyperliquid'}</Text>
        </View>
        <View style={[s.box, on ? { backgroundColor: theme.brand, borderColor: theme.brand } : { borderColor: dark ? '#4A4E6E' : '#C9CAD3' }]}>
          {on ? <CheckIcon size={14} color="#FFFFFF" strokeWidth={3} /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={s.root} testID="perpsAssetPicker">
      <View style={s.header}>
        <Pressable
          onPress={onBack}
          style={[s.circle, { backgroundColor: dark ? '#232640' : '#F0F0F2' }]}
          accessibilityLabel="Back to filters"
          hitSlop={8}
          testID="assetBack"
        >
          <BackIcon size={18} color={ink} />
        </Pressable>
        <View style={s.titleWrap} pointerEvents="none">
          <Text style={[s.title, { color: ink }]}>Assets</Text>
        </View>
        <Pressable
          onPress={() => setPicked([])}
          disabled={picked.length === 0}
          hitSlop={12}
          accessibilityLabel="Clear selected assets"
          testID="assetClear"
        >
          <Text style={[s.clear, { color: picked.length ? ink : dark ? '#5B5F78' : '#CECDD0' }]}>Clear</Text>
        </Pressable>
      </View>

      <View style={[s.search, { backgroundColor: fill }]}>
        <SearchIcon size={18} color={muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search assets"
          placeholderTextColor={muted}
          style={[s.input, { color: ink }]}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel="Search assets"
          testID="assetSearch"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <CloseIcon size={16} color={muted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.symbol}
        renderItem={renderRow}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty} testID="assetEmpty">
            <Text style={[s.emptyTitle, { color: ink }]}>No assets found</Text>
            <Text style={[s.emptyBody, { color: muted }]}>
              {providers.length ? 'Nothing matches that search for the chosen provider.' : 'Nothing matches that search.'}
            </Text>
          </View>
        }
      />

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={() => onDone(picked)}
          style={({ pressed }) => [s.done, { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 }]}
          accessibilityLabel={picked.length ? `Done, ${picked.length} selected` : 'Done'}
          testID="assetDone"
        >
          <Text style={s.doneText}>{picked.length ? `Done (${picked.length})` : 'Done'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 42, marginTop: 6, marginBottom: 12, marginHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { position: 'absolute', left: 0, right: 0, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT.semiBold, fontSize: 16, lineHeight: 22 },
  clear: { fontFamily: FONT.semiBold, fontSize: 16, lineHeight: 22, marginRight: 4 },
  search: { height: 44, marginHorizontal: 16, marginBottom: 6, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontFamily: FONT.regular, fontSize: 15, paddingVertical: 0 },
  row: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sym: { fontFamily: FONT.semiBold, fontSize: 16, lineHeight: 22 },
  sub: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 18 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FONT.semiBold, fontSize: 16, lineHeight: 22 },
  emptyBody: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  done: { height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#FFFFFF', fontFamily: FONT.bold, fontSize: 16 },
});
