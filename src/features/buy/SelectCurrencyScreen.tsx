/**
 * Select currency (Buy). Layout measured from Trust's recording (411dp):
 *   back circle 46dp, centered 16/Heading title, search pill 48dp at y108,
 *   rows 77dp pitch with a 44dp round flag on the left, code (Heading) and
 *   name (muted) stacked beside it.
 *
 * Loading (as asked): on open the whole list is skeleton rows (grey flag disc
 * + two bars). After a beat the rows resolve and the flags then LOAD IN
 * waves, country by country, each fading in over its grey disc. Rows scrolled
 * into view later also show the grey disc for a moment before the flag lands.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { SkeletonBlock } from '../../components/Skeleton';
import { BackIcon, SearchIcon } from '../../components/icons';
import { CURRENCIES, Currency } from './currencies';
import { Flag } from './Flag';

const ROW_H = 77;

function SkeletonRow() {
  return (
    <View style={styles.row}>
      <SkeletonBlock style={styles.flagSk} />
      <View style={styles.texts}>
        <SkeletonBlock style={styles.skCode} />
        <SkeletonBlock style={styles.skName} />
      </View>
    </View>
  );
}

export default function SelectCurrencyScreen({ navigation, route }: { navigation: any; route: any }) {
  const { theme } = useTheme();
  const selected: string = route?.params?.selected ?? 'USD';
  const [query, setQuery] = useState('');
  const [listReady, setListReady] = useState(false);
  // Codes whose flag has finished "loading". Waves release them progressively.
  const [flagsReady, setFlagsReady] = useState<Record<string, boolean>>({});
  const waveTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 1) list skeleton -> rows
  useEffect(() => {
    const t = setTimeout(() => setListReady(true), 700);
    return () => clearTimeout(t);
  }, []);

  // 2) once rows exist, load flags in waves of 4, every 90ms
  const releaseFlags = useCallback((codes: string[]) => {
    codes.forEach((code, i) => {
      const t = setTimeout(
        () => setFlagsReady((p) => (p[code] ? p : { ...p, [code]: true })),
        Math.floor(i / 4) * 90,
      );
      waveTimers.current.push(t);
    });
  }, []);

  useEffect(() => {
    if (!listReady) return;
    releaseFlags(CURRENCIES.slice(0, 16).map((c) => c.code));
    return () => waveTimers.current.forEach(clearTimeout);
  }, [listReady, releaseFlags]);

  // Rows that scroll into view later load their flag after a short beat.
  const onViewable = useRef(({ viewableItems }: { viewableItems: Array<{ item?: unknown }> }) => {
    const pending = viewableItems
      .map((v) => (v.item as Currency | undefined)?.code)
      .filter((c): c is string => !!c);
    if (pending.length) {
      const t = setTimeout(
        () =>
          setFlagsReady((p) => {
            const next = { ...p };
            pending.forEach((c) => (next[c] = true));
            return next;
          }),
        320,
      );
      waveTimers.current.push(t);
    }
  }).current;

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [query]);

  const circleBg = theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : '#EFEFF3';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          hitSlop={10}
          onPress={() => navigation.goBack()}
          style={[styles.back, { backgroundColor: circleBg }]}
        >
          <BackIcon size={22} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Select currency</Text>
        <View style={styles.back} />
      </View>

      <View style={[styles.search, { backgroundColor: circleBg }]}>
        <SearchIcon size={18} color={theme.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search currencies"
          placeholderTextColor={theme.inkMuted}
          style={[styles.searchInput, { color: theme.ink }]}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {!listReady ? (
        <View style={styles.list}>
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(c) => c.code}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => {
                // Hand the choice to Buy (merge keeps the Buy route in place), then pop.
                navigation.popTo('Buy', { pickedCurrency: item.code });
              }}
            >
              <Flag code={item.flag} size={44} ready={!!flagsReady[item.code]} />
              <View style={styles.texts}>
                <Text style={[styles.code, { color: theme.ink }]}>{item.code}</Text>
                <Text style={[styles.name, { color: theme.inkMuted }]}>{item.name}</Text>
              </View>
              {item.code === selected && <View style={[styles.dot, { backgroundColor: theme.ink }]} />}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, justifyContent: 'space-between' },
  back: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, lineHeight: 24, fontFamily: 'Inter-700', fontWeight: '700' },
  search: { marginHorizontal: 17, marginTop: 8, marginBottom: 6, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter-500', padding: 0 },
  list: { flex: 1, paddingHorizontal: 17 },
  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 16 },
  texts: { flex: 1, gap: 5 },
  code: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-700', fontWeight: '700' },
  name: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-500' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  flagSk: { width: 44, height: 44, borderRadius: 22 },
  skCode: { width: 54, height: 16, borderRadius: 4 },
  skName: { width: 110, height: 12, borderRadius: 4 },
});
