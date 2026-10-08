/**
 * Veltravia Wallet — Activity (opened from the Home bell).
 *
 * Mirrors the Trust reference: back + centered title + filter circle;
 * empty state with illustration, "No activity yet" and a hint; a
 * "Show older activity" pill that, once tapped, loads and disappears;
 * pull-to-refresh that drops a white spinner circle above the content.
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

export default function ActivityScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dark = theme.mode === 'dark';

  const [refreshing, setRefreshing] = useState(false);
  const [showOlder, setShowOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pillOpacity = useRef(new Animated.Value(1)).current;

  const chipBg = dark ? 'rgba(255,255,255,0.12)' : 'rgba(60,64,90,0.08)';
  const pillBg = dark ? 'rgba(255,255,255,0.10)' : '#EDEDF0';
  const pageBg = dark ? theme.background : '#FDFDFE';

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

      {/* ---------- Header ---------- */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          hitSlop={10}
          onPress={() => navigation.goBack()}
          style={[styles.circle, { backgroundColor: chipBg }]}
        >
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <View style={[styles.titleWrap, { top: insets.top + 10 }]} pointerEvents="none">
          <Text style={[styles.title, { color: theme.ink }]}>Activity</Text>
        </View>
        <Pressable
          hitSlop={10}
          onPress={() => {}}
          style={[styles.circle, { backgroundColor: chipBg }]}
        >
          <FilterLinesIcon size={22} color={theme.ink} />
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
            progressViewOffset={insets.top + 70}
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
              style={({ pressed }) => [styles.pill, { backgroundColor: pillBg, opacity: pressed ? 0.8 : 1 }]}
            >
              {loadingOlder ? (
                <ActivityIndicator color={theme.ink} />
              ) : (
                <Text style={[styles.pillText, { color: theme.ink }]}>Show older activity</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  circle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { position: 'absolute', left: 0, right: 0, height: 52, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', letterSpacing: -0.2 },

  body: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 36, paddingBottom: 40 },
  art: { width: 136, height: 136 },
  headline: { fontSize: 29, fontWeight: '800', letterSpacing: -0.6, marginTop: 22 },
  sub: { fontSize: 17, marginTop: 14, textAlign: 'center' },
  pill: {
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 34,
    marginHorizontal: 22,
  },
  pillText: { fontSize: 18, fontWeight: '600' },
});
