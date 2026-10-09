/**
 * Veltravia Wallet — Activity (opened from the Home bell).
 *
 * Sizes follow Trust Wallet's real design system, extracted from the
 * decompiled Trust APK bundle (see src/theme/typography.ts):
 *   - header circles 36dp, header icons 24dp, nav title 16 SemiBold
 *   - illustration 160dp, marginBottom 24 (spacing lg)
 *   - headline "No activity yet" = Title2: 24 Bold / lh34
 *   - description = Subtitle: 16 Medium / lh22, secondary grey
 *   - "Show older activity" = tertiary text button: 16 SemiBold grey,
 *     56dp full-width row, no background (Trust light-mode style)
 * v1 has no on-chain history yet (Wallet Core phase), so the list stays
 * empty after a refresh.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Animated,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon, FilterLinesIcon } from '../components/icons';
import { FONT, T, SP, TOUCH } from '../theme/typography';

export default function ActivityScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = theme.mode === 'dark';

  const [refreshing, setRefreshing] = useState(false);
  const [showOlder, setShowOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pillOpacity = useRef(new Animated.Value(1)).current;

  const chipBg = dark ? 'rgba(255,255,255,0.12)' : 'rgba(60,64,90,0.08)';
  const pageBg = dark ? theme.background : '#FFFFFF';

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // No history source yet: simulate the fetch round-trip.
    setTimeout(() => setRefreshing(false), 1400);
  }, []);

  const onShowOlder = useCallback(() => {
    if (loadingOlder) return;
    setLoadingOlder(true);
    setTimeout(() => {
      Animated.timing(pillOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setShowOlder(false);
        setLoadingOlder(false);
      });
    }, 900);
  }, [loadingOlder, pillOpacity]);

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* ---------- Header (Trust: 36dp circles, 24dp icons, 16 SemiBold title) ---------- */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          hitSlop={12}
          onPress={() => navigation.goBack()}
          style={[styles.circle, { backgroundColor: chipBg }]}
        >
          <BackIcon size={TOUCH.headerIcon} color={theme.ink} />
        </Pressable>
        <View style={[styles.titleWrap, { top: insets.top + 8 }]} pointerEvents="none">
          <Text style={[styles.title, { color: theme.ink }]}>Activity</Text>
        </View>
        <Pressable
          hitSlop={12}
          onPress={() => {}}
          style={[styles.circle, { backgroundColor: chipBg }]}
        >
          <FilterLinesIcon size={TOUCH.headerIcon} color={theme.ink} />
        </Pressable>
      </View>

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
        <Image source={require('../assets/no-activity-ufo.png')} style={styles.art} resizeMode="contain" />
        <Text style={[styles.headline, { color: theme.ink }]}>No activity yet</Text>
        <Text style={[styles.sub, { color: theme.inkMuted }]}>Your transactions will appear here</Text>

        {showOlder && (
          <Animated.View style={{ opacity: pillOpacity, alignSelf: 'stretch' }}>
            <Pressable
              onPress={onShowOlder}
              style={({ pressed }) => [styles.olderBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              {loadingOlder ? (
                <ActivityIndicator color={theme.inkMuted} />
              ) : (
                <Text style={[styles.olderText, { color: theme.inkMuted }]}>Show older activity</Text>
              )}
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
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

  body: { alignItems: 'center', paddingHorizontal: SP.xxl, paddingTop: SP.xl, paddingBottom: SP.xl },
  art: { width: 160, height: 160, marginBottom: SP.lg },
  headline: T.title2,
  sub: { ...T.subtitle, marginTop: SP.xs, textAlign: 'center' },

  // Trust tertiary button: 56dp full-width row, text only, no fill.
  olderBtn: {
    height: TOUCH.buttonLarge,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SP.lg,
  },
  olderText: T.buttonLarge,
});
