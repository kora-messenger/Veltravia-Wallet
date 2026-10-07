/**
 * Veltravia Wallet — floating pill tab bar with a raised center Swap button.
 *
 * Layout (bottom up): 20pt margin → 64pt pill holding Home, Markets,
 * Discover and Settings → the Swap button is a 58pt circle anchored to the
 * pill's center that pokes out above its top edge. The container is
 * transparent; only the pill and the raised button catch touches.
 */

import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import {
  HomeTabIcon,
  MarketsTabIcon,
  SwapIcon,
  DiscoverTabIcon,
  SettingsTabIcon,
} from './icons';

const TAB_ICONS: Record<string, React.ComponentType<any>> = {
  Home: HomeTabIcon,
  Markets: MarketsTabIcon,
  Discover: DiscoverTabIcon,
  Settings: SettingsTabIcon,
};

/** Icons shown inside the pill, in order. Swap lives outside, raised. */
const SIDE_TABS: Array<keyof typeof TAB_ICONS> = ['Home', 'Markets', 'Discover', 'Settings'];

const PILL_H = 64;
const PILL_BOTTOM = 20;
const SWAP_SIZE = 58;
const SWAP_BOTTOM = 36; // raised: top edge clears the pill's top edge
const BAR_H = PILL_BOTTOM + PILL_H + (SWAP_BOTTOM + SWAP_SIZE - PILL_BOTTOM - PILL_H) + 8;

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const focusedName = state.routes[state.index]?.name as string;

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) navigation.navigate(route.key);
  };

  const renderSide = (name: string) => {
    const focused = focusedName === name;
    const Icon = TAB_ICONS[name];
    return (
      <Pressable
        key={name}
        onPress={() => go(name)}
        hitSlop={4}
        style={styles.tabItem}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: focused ? 'rgba(108,76,245,0.12)' : 'transparent' },
          ]}
        >
          <Icon size={24} color={focused ? '#6C4CF5' : theme.inkMuted} filled={focused} />
        </View>
      </Pressable>
    );
  };

  const swapFocused = focusedName === 'Swap';

  return (
    <View
      pointerEvents="box-none"
      style={{ height: BAR_H + insets.bottom, backgroundColor: 'transparent' }}
    >
      {/* pill */}
      <View
        style={[
          styles.pill,
          {
            bottom: PILL_BOTTOM + insets.bottom,
            backgroundColor: theme.surface,
            borderColor:
              theme.mode === 'dark'
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(6,14,44,0.06)',
            shadowOpacity: theme.mode === 'dark' ? 0.4 : 0.12,
          },
        ]}
      >
        {SIDE_TABS.slice(0, 2).map(renderSide)}
        <View style={{ width: SWAP_SIZE + 8 }} />
        {SIDE_TABS.slice(2).map(renderSide)}
      </View>

      {/* raised center Swap button */}
      <Pressable
        onPress={() => go('Swap')}
        style={({ pressed }) => [
          styles.swapBtn,
          {
            bottom: SWAP_BOTTOM + insets.bottom,
            backgroundColor: theme.surface,
            borderColor:
              theme.mode === 'dark'
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(6,14,44,0.07)',
            shadowOpacity: (theme.mode === 'dark' ? 0.4 : 0.14) * (pressed ? 0.6 : 1),
          },
        ]}
      >
        <SwapIcon
          size={26}
          color={swapFocused ? '#6C4CF5' : theme.inkMuted}
          strokeWidth={2.2}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: PILL_H,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    borderWidth: 1,
    elevation: 12,
    shadowColor: '#060E2C',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  swapBtn: {
    position: 'absolute',
    alignSelf: 'center',
    width: SWAP_SIZE,
    height: SWAP_SIZE,
    borderRadius: SWAP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 16,
    shadowColor: '#060E2C',
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
