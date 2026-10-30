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
import { Pressable, View, StyleSheet, Animated, Easing } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';
import AnimatedTabIcon, { TabIconHandle } from './AnimatedTabIcon';
import {
  HomeTabIcon,
  MarketsTabIcon,
  SwapIcon,
  DiscoverTabIcon,
  InfinityIcon,
} from './icons';

const TAB_ICONS: Record<string, React.ComponentType<any>> = {
  Home: HomeTabIcon,
  Markets: MarketsTabIcon,
  Discover: DiscoverTabIcon,
  Perps: InfinityIcon,
};

/** Icons inside the pill, in order. Swap lives in the center notch. */
const SIDE_TABS: Array<keyof typeof TAB_ICONS> = ['Home', 'Markets', 'Discover', 'Perps'];

const PILL_H = 64; // pill height (also the corner radius: fully rounded ends)
const PILL_BOTTOM = 20; // gap between pill and the bottom edge of the screen
const PILL_SIDE = 24; // side margins
const NOTCH_R = 36; // radius of the dip around the Swap button (button radius + gap)
const SWAP_SIZE = 58;
// Active highlight: a true circle (radius = 50%), centred on the icon. The cell
// keeps its 48x32 footprint so no icon moves; the circle is allowed to overflow
// it evenly into the pill's spare height (64 - 40 = 12dp top and bottom).
const HIGHLIGHT = 40;
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

/**
 * The active indicator: one fully rounded circle that grows and fades in when a
 * tab becomes active, and shrinks away when it leaves. Native-driven, so the
 * switch stays smooth while a screen is mounting.
 */
function ActiveHighlight({ active, color }: { active: boolean; color: string }) {
  const v = React.useRef(new Animated.Value(active ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.timing(v, {
      toValue: active ? 1 : 0,
      duration: active ? 200 : 150,
      easing: active ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, v]);
  return (
    <Animated.View
      pointerEvents="none"
      testID="tabHighlight"
      style={[
        styles.highlight,
        { backgroundColor: color, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] },
      ]}
    />
  );
}

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [pillW, setPillW] = React.useState(0);
  const focusedName = state.routes[state.index]?.name as string;
  const tabRefs = React.useRef<Record<string, TabIconHandle | null>>({});

  const go = (name: string) => {
    // Every bottom icon pulses on tap, even when already focused.
    tabRefs.current[name]?.pulse();
    // Discover is a full-screen screen above the tabs (Trust parity): no tab
    // bar is mounted over it, and its X pops back to the tab the user left.
    if (name === 'Discover') {
      (navigation as any).getParent()?.navigate('Discover');
      return;
    }
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) navigation.navigate(route.name);
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
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
      >
        <View style={styles.iconWrap}>
          <ActiveHighlight active={focused} color={highlightColor} />
          <AnimatedTabIcon
            ref={(h) => { tabRefs.current[name] = h; }}
          >
            <Icon size={24} color={focused ? '#6C4CF5' : theme.inkMuted} filled={focused} />
          </AnimatedTabIcon>
        </View>
      </Pressable>
    );
  };

  const swapFocused = focusedName === 'Swap';
  // Subtle light grey that reads as a soft tint on the pill, never a box.
  const highlightColor = theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : '#EFEFF2';
  // Trust parity: milk interior with a tiny dark-gray hairline around it
  // (light), deep navy surface with a faint light hairline (dark).
  const pillBg = theme.mode === 'dark' ? '#07101E' : '#FAFAFB';
  const borderColor =
    theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#D1D1D4';

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
              fill={pillBg}
              stroke={borderColor}
              strokeWidth={1}
            />
          </Svg>
        )}
        <View style={styles.row} pointerEvents="box-none">
          <View style={styles.group}>{SIDE_TABS.slice(0, 2).map(renderSide)}</View>
          <View style={{ width: NOTCH_R * 2 + 16 }} />
          <View style={styles.group}>{SIDE_TABS.slice(2).map(renderSide)}</View>
        </View>
      </View>

      {/* raised center Swap button, floating in the notch */}
      <Pressable
        onPress={() => go('Swap')}
        accessibilityRole="tab"
        accessibilityLabel="Swap"
        accessibilityState={{ selected: swapFocused }}
        style={({ pressed }) => [
          styles.swapBtn,
          {
            bottom: SWAP_BOTTOM + insets.bottom,
            backgroundColor: swapFocused ? (theme.mode === 'dark' ? '#1A1E2E' : '#EFEFF2') : pillBg,
            borderColor,
            shadowOpacity: (theme.mode === 'dark' ? 0.4 : 0.14) * (pressed ? 0.6 : 1),
          },
        ]}
      >
        <AnimatedTabIcon
          ref={(h) => { tabRefs.current.Swap = h; }}
        >
          <SwapIcon
            size={26}
            color={swapFocused ? '#6C4CF5' : theme.inkMuted}
            strokeWidth={2.2}
          />
        </AnimatedTabIcon>
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
    paddingHorizontal: 10,
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
    width: 48,
    height: 32,          // unchanged footprint: nothing moves
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    width: HIGHLIGHT,
    height: HIGHLIGHT,
    borderRadius: HIGHLIGHT / 2,   // 50%: a circle, not a box
    // centred on the icon even though it is taller than the cell
    top: (32 - HIGHLIGHT) / 2,
    left: (48 - HIGHLIGHT) / 2,
  },
  // Left/right icon groups stay inside the capsule's straight section so the
  // rounded ends curve around empty space, like Trust (no indicator poking out).
  group: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
});
