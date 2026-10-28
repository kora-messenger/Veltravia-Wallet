/**
 * Veltravia Wallet — Perps Activity screen (Trust 10:21 screenshot).
 *
 * A separate screen from the main wallet Activity (different data source:
 * perps trades/positions, not wallet transfers). Built with the same
 * pattern as the wallet one:
 *   - header: 36dp circles, back left, centred "Activity" 16 SemiBold,
 *     filter-lines button right (opens the same Filters sheet)
 *   - first load: the shared skeleton list
 *   - empty state: the Veltravia no-activity robot illustration,
 *     "No activity yet" (24 Bold) / "Your transactions will appear here"
 *   - "Show older activity" pill, state-driven auto-hide
 *   - offline (Trust 10:22): the Veltravia sad no-Wi-Fi robot illustration,
 *     "Failed to load activity", a "Retry" pill — same as the wallet screen.
 *   - pull-to-refresh: native spinner + the shimmer skeleton search.
 * No perps history source yet (live trading comes after Wallet Core
 * signing), so the list settles empty.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Image, Animated,
  StatusBar, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon, FilterLinesIcon } from '../components/icons';
import { T, SP, TOUCH } from '../theme/typography';
import { ActivitySkeleton } from '../components/Skeleton';
import NetInfo from '@react-native-community/netinfo';
import FilterSheet, { ActivityFilters, DEFAULT_ACTIVITY_FILTERS } from '../components/FilterSheet';

export default function PerpsActivityScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = theme.mode === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [pillOpacity, setPillOpacity] = useState(() => new Animated.Value(1));
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ActivityFilters>(DEFAULT_ACTIVITY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const chipBg = dark ? 'rgba(255,255,255,0.12)' : 'rgba(60,64,90,0.08)';
  const pageBg = dark ? theme.background : '#FFFFFF';
  const tertiary = theme.surfaceAlt;

  const hidePill = useCallback(() => {
    Animated.timing(pillOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [pillOpacity]);

  // Same reachability gate as the wallet Activity: only a genuinely offline
  // phone shows the error screen (live perps history arrives later).
  const loadActivity = useCallback(async () => {
    setLoadError(null);
    setIsLoading(true);
    const state = await NetInfo.fetch();
    const online = state.isConnected === true && state.isInternetReachable !== false;
    await new Promise<void>(r => setTimeout(r, 900));
    if (!online) setLoadError('offline');
    setIsLoading(false);
  }, []);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  useEffect(() => {
    if (isLoading || loadError) return;
    const t = setTimeout(() => { setHasNextPage(false); hidePill(); }, 5000);
    return () => clearTimeout(t);
  }, [isLoading, loadError, hidePill]);

  // Retry (button or drag on the error view): a full reload — the native
  // spinner cycles on the pull and the skeleton re-runs its shimmer search.
  const retry = useCallback(async () => {
    await loadActivity();
  }, [loadActivity]);

  // Pull-to-refresh on the list: the native spinner cycles AND the screen
  // swaps to the shimmering skeleton "searching for any activity" until the
  // fetch settles (Trust 10:22 recording).
  const onRefresh = useCallback(async () => {
    if (refreshing || isLoading) return;
    setRefreshing(true);
    const state = await NetInfo.fetch();
    const online = state.isConnected === true && state.isInternetReachable !== false;
    await new Promise<void>(r => setTimeout(r, 1200)); // the skeleton's visible search
    setRefreshing(false);
    setLoadError(online ? null : 'offline');
  }, [refreshing, isLoading]);

  const canLoadOlder = hasNextPage && !isFetchingOlder && !refreshing && !isLoading && !loadError;

  const onShowOlder = useCallback(() => {
    if (!canLoadOlder) return;
    setIsFetchingOlder(true);
    setTimeout(() => { setHasNextPage(false); setIsFetchingOlder(false); hidePill(); }, 1200);
  }, [canLoadOlder, hidePill]);

  const showSkeleton = isLoading || refreshing;

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* Header: back, centred "Activity", filter-lines button */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()} style={[styles.circle, { backgroundColor: chipBg }]}>
          <BackIcon size={TOUCH.headerIcon} color={theme.ink} />
        </Pressable>
        <View style={[styles.titleWrap, { top: insets.top + 8 }]} pointerEvents="none">
          <Text style={[styles.title, { color: theme.ink }]}>Activity</Text>
        </View>
        <Pressable hitSlop={12} onPress={() => setSheetOpen(true)} style={[styles.circle, { backgroundColor: chipBg }]}>
          <FilterLinesIcon size={TOUCH.headerIcon} color={theme.ink} />
        </Pressable>
      </View>

      {showSkeleton ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: SP.xl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.ink}
              colors={[theme.brandGradient[0]]}
              progressBackgroundColor={dark ? theme.surface : '#FFFFFF'}
              progressViewOffset={insets.top + 56}
            />
          }
        >
          <ActivitySkeleton />
        </ScrollView>
      ) : loadError ? (
        <ScrollView
          contentContainerStyle={styles.errorBody}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.ink}
              colors={[theme.brandGradient[0]]}
              progressBackgroundColor={dark ? theme.surface : '#FFFFFF'}
              progressViewOffset={insets.top + 56}
            />
          }
        >
          <Image
            source={require('../assets/activity-error-robot.png')}
            style={styles.errorArt}
            resizeMode="contain"
          />
          <Text style={[styles.errorLine, { color: theme.inkMuted }]}>Failed to load activity</Text>
          <Pressable
            onPress={retry}
            style={({ pressed }) => [styles.retryBtn, { backgroundColor: tertiary, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[T.buttonLarge, { color: theme.ink }]}>Retry</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.ink}
              colors={[theme.brandGradient[0]]}
              progressBackgroundColor={dark ? theme.surface : '#FFFFFF'}
              progressViewOffset={insets.top + 56}
            />
          }
        >
          <Image
            source={dark ? require('../assets/no-activity-robot-dark.png') : require('../assets/no-activity-robot.png')}
            style={styles.art}
            resizeMode="contain"
          />
          <Text style={[styles.headline, { color: theme.ink }]}>No activity yet</Text>
          <Text style={[styles.sub, { color: theme.inkMuted }]}>Your transactions will appear here</Text>

          {canLoadOlder && (
            <Animated.View style={{ opacity: pillOpacity, alignSelf: 'stretch' }}>
              <Pressable
                onPress={onShowOlder}
                style={({ pressed }) => [styles.olderPill, { backgroundColor: tertiary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[T.buttonLarge, { color: theme.ink }]}>Show older activity</Text>
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      )}

      <FilterSheet visible={sheetOpen} filters={filters} onClose={() => setSheetOpen(false)} onApply={setFilters} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SP.md,
    paddingBottom: SP.xs,
  },
  circle: {
    width: TOUCH.headerCircle,
    height: TOUCH.headerCircle,
    borderRadius: TOUCH.headerCircle / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TOUCH.headerCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: T.heading,

  body: { alignItems: 'center', paddingHorizontal: SP.xxl, paddingTop: SP.lg, paddingBottom: SP.xl },
  art: { width: 128, height: 128, marginTop: 12, marginBottom: 20 },
  headline: { ...T.title2, textAlign: 'center' },
  sub: { ...T.subtitle, marginTop: 8, textAlign: 'center' },

  errorBody: { alignItems: 'center', paddingHorizontal: SP.xxl, paddingTop: SP.sm },
  // the sad no-Wi-Fi robot (Ijezie's illustration, 566x929) — transparent art,
  // so the same asset serves light and dark.
  errorArt: { width: 96, height: 158, marginTop: 20, marginBottom: 28 },
  errorLine: { ...T.subtitle, textAlign: 'center' },
  retryBtn: {
    width: 288,
    height: 59,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SP.xl,
  },
  olderPill: {
    width: 288,
    height: 59,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SP.xxl,
  },
});
