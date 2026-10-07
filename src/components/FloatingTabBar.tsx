/**
 * Veltravia Wallet — floating tab bar overlay.
 *
 * The bar is a pure overlay: scenes render full-height behind it, so the
 * screen background runs to the bottom edge of the device. The pill is a
 * white rounded shape with a circular notch cut out of its center (the
 * Swap button floats in that notch, raised above the pill's top edge).
 * No footer strip, no extra surface behind anything.
 */

import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

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

/** Icons inside the pill, in order. Swap lives in the center notch. */
const SIDE_TABS: Array<keyof typeof TAB_ICONS> = ['Home', 'Markets', 'Discover', 'Settings'];

const PILL_H = 64; // pill height (also the corner radius: fully rounded ends)
const PILL_BOTTOM = 20; // gap between pill and the bottom edge of the screen
const PILL_SIDE = 24; // side margins
const NOTCH_R = 36; // radius of the dip around the Swap button (button radius + gap)
const SWAP_SIZE = 58;
// Swap circle is centered ON the dip: its center sits exactly on the pill's top edge
const SWAP_BOTTOM = PILL_BOTTOM + PILL_H - SWAP_SIZE / 2;

/**
 * Rounded pill whose TOP edge dips smoothly around the Swap circle.
 * The dip is a circular arc of radius NOTCH_R centred on the top edge,
 * joined to the straight top edge by small fillets so it reads as one curve.
 */
function pillPath(w: number): string {
  const r = PILL_H / 2;
  const cx = w / 2;
  const f = 10; // fillet radius where the dip meets the top edge
  const a = NOTCH_R + f;
  return (
    `M0 ${r} A${r} ${r} 0 0 1 ${r} 0 ` +
    `H ${cx - a} ` +
    `Q ${cx - NOTCH_R} 0 ${cx - NOTCH_R} ${f} ` +
    `A${NOTCH_R} ${NOTCH_R} 0 0 0 ${cx + NOTCH_R} ${f} ` +
    `Q ${cx + NOTCH_R} 0 ${cx + a} 0 ` +
    `H ${w - r} A${r} ${r} 0 0 1 ${w} ${r} ` +
    `A${r} ${r} 0 0 1 ${w - r} ${PILL_H} ` +
    `H ${r} A${r} ${r} 0 0 1 0 ${r} Z`
  );
}

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [pillW, setPillW] = React.useState(0);
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
      <Pressable key={name} onPress={() => go(name)} hitSlop={4} style={styles.tabItem}>
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
  const borderColor =
    theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(6,14,44,0.07)';

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {/* pill with notched center */}
      <View
        style={[
          styles.pill,
          {
            bottom: PILL_BOTTOM + insets.bottom,
            shadowOpacity: theme.mode === 'dark' ? 0.4 : 0.12,
          },
        ]}
        onLayout={(e) => setPillW(e.nativeEvent.layout.width)}
      >
        {pillW > 0 && (
          <Svg width={pillW} height={PILL_H} style={StyleSheet.absoluteFill}>
            <Path
              d={pillPath(pillW)}
              fill={theme.surface}
              stroke={borderColor}
              strokeWidth={1}
            />
          </Svg>
        )}
        <View style={styles.row} pointerEvents="box-none">
          {SIDE_TABS.slice(0, 2).map(renderSide)}
          <View style={{ width: NOTCH_R * 2 + 16 }} />
          {SIDE_TABS.slice(2).map(renderSide)}
        </View>
      </View>

      {/* raised center Swap button, floating in the notch */}
      <Pressable
        onPress={() => go('Swap')}
        style={({ pressed }) => [
          styles.swapBtn,
          {
            bottom: SWAP_BOTTOM + insets.bottom,
            backgroundColor: theme.surface,
            borderColor,
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
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'transparent',
  },
  pill: {
    position: 'absolute',
    left: PILL_SIDE,
    right: PILL_SIDE,
    height: PILL_H,
    elevation: 12,
    shadowColor: '#060E2C',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
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
