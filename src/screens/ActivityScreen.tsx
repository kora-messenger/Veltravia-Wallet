/**
 * Veltravia Wallet — Activity (opened from the Home bell).
 *
 * Sizes & behaviour follow Trust Wallet's real design system, extracted
 * from the decompiled Trust APK (see src/theme/typography.ts) and the
 * 2026-10-09 screen recordings:
 *   - header circles 36dp, header icons 24dp, nav title 16 SemiBold
 *   - initial load shows the skeleton placeholder list (SKELETON_ROWS:
 *     section + 2 rows, section + 6 rows, shared opacity pulse)
 *   - empty state: 78dp illustration, ~40dp gap, "No activity yet"
 *     Title2 24 Bold, description 16 Medium secondary grey
 *   - "Show older activity" is a 288x59 grey pill (not a text button),
 *     visible only while canLoadOlder = hasNextPage && !fetching;
 *     it disappears on its own once the background refresh confirms
 *     there is no older history (Trust behaviour: state-driven, not
 *     timer-driven)
 *   - the filter button opens the Filters sheet (FilterSheet.tsx)
 * v1 has no on-chain history yet (Wallet Core phase), so the list stays
 * empty after a refresh.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Animated,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon, FilterLinesIcon } from '../components/icons';
import { T, SP, RADIUS, TOUCH } from '../theme/typography';
import { ActivitySkeleton } from '../components/Skeleton';
import FilterSheet, { ActivityFilters, DEFAULT_ACTIVITY_FILTERS } from '../components/FilterSheet';

export default function ActivityScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = theme.mode === 'dark';

  // ---- list state (no history source yet; shaped like Trust's useOrdersActivity) ----
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true); // older history not ruled out yet
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [pillOpacity, setPillOpacity] = useState(() => new Animated.Value(1));

  const [filters, setFilters] = useState<ActivityFilters>(DEFAULT_ACTIVITY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const chipBg = dark ? 'rgba(255,255,255,0.12)' : 'rgba(60,64,90,0.08)';
  const pageBg = dark ? theme.background : '#FFFFFF';
  const tertiary = theme.surfaceAlt;

  const hidePill = useCallback(() => {
    Animated.timing(pillOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [pillOpacity]);

  // Initial load: skeleton, then empty list.
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1300);
    return () => clearTimeout(t);
  }, []);

  // Background confirmation (Trust arms a realtime session on open): once
  // the first load settles and the list is still empty, a refresh confirms
  // there is no older history and the pill goes away by itself.
  useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(() => {
      setHasNextPage(false);
      hidePill();
    }, 5000);
    return () => clearTimeout(t);
  }, [isLoading, hidePill]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1400);
  }, []);

  // Trust's formula: canLoadOlder = hasNextPage && !isFetchingNextPage && !isRefetching
  const canLoadOlder = hasNextPage && !isFetchingOlder && !refreshing && !isLoading;

  const onShowOlder = useCallback(() => {
    if (!canLoadOlder) return;
    setIsFetchingOlder(true); // canLoadOlder flips off -> the pill hides during the fetch
    setTimeout(() => {
      setHasNextPage(false); // nothing older came back
      setIsFetchingOlder(false);
      hidePill();
    }, 1200);
  }, [canLoadOlder, hidePill]);

  const showSkeleton = isLoading || refreshing;

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* ---------- Header (Trust: 36dp circles, 24dp icons, 16 SemiBold title) ---------- */}
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SP.xl }}>
          <ActivitySkeleton />
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

  // Empty state: Trust's headline sits 160dp below the header, so the
  // illustration block (top margin + height + gap) is held at 160dp. The
  // Veltravia AI robot is a denser character than Trust's UFO, so it gets a
  // 128dp box (face + hands stay legible) with the margins reduced to match.
  art: { width: 128, height: 128, marginTop: 12, marginBottom: 20 },
  headline: T.title2,
  sub: { ...T.subtitle, marginTop: 8, textAlign: 'center' },

  // Grey pill: 322x66px at 461px capture = ~288x59dp, radius 16.
  olderPill: {
    width: 288,
    height: 59,
    borderRadius: RADIUS.md,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SP.xl + SP.xs,
  },
});
