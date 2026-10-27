/**
 * Veltravia Wallet — "How perps work?" instructions carousel (Trust parity).
 *
 * Opened from Settings > Perps > "How perps work?". Six swipeable steps with
 * a segmented progress bar (check = done, ring = current, empty = ahead),
 * a title + body per step, an illustration slot, and Next / Skip buttons.
 * The last step's primary button reads "Got it" and closes the flow. Skip and
 * the Android back gesture both close it.
 *
 * All six illustrations live in src/assets/perps-guide/. To replace one, swap
 * the file and keep the same name.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, Image, useWindowDimensions,
  type ImageSourcePropType, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

// App violet (#6C63FF) darkened to Trust's button depth (matches Perps CTAs).
const VIOLET_DEEP = '#5147E6';

/**
 * Optional art per step. Add the PNG and uncomment its require() line; a missing
 * file must not break the bundle, so each is wired explicitly.
 *   1  intro        perps-guide/step1-intro.png
 *   2  what         perps-guide/step2-what.png
 *   3  leverage     perps-guide/step3-leverage.png
 *   4  long/short   perps-guide/step4-long-short.png
 *   5  liquidation  perps-guide/step5-liquidation.png
 *   6  start        perps-guide/step6-start.png
 */
export const STEP_ART: Array<ImageSourcePropType | null> = [
  require('../assets/perps-guide/step1-intro.png'),
  require('../assets/perps-guide/step2-what.png'),
  require('../assets/perps-guide/step3-leverage.png'),
  require('../assets/perps-guide/step4-long-short.png'),
  require('../assets/perps-guide/step5-liquidation.png'),
  require('../assets/perps-guide/step6-start.png'),
];

export interface GuideStep {
  key: string;
  title: string;
  /** One paragraph, or several lines (rendered as separate lines). */
  lines: string[];
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    key: 'intro',
    title: 'Introducing Perps',
    lines: ['Trade like a pro. Stay in control.', 'Access 100+ markets. Go long or short.', 'Up to 100x leverage.'],
  },
  {
    key: 'what',
    title: 'What are Perps?',
    lines: ['Perpetuals are futures-style markets that let you trade price movements without owning the asset. You can profit from both ups and downs with no expiry date.'],
  },
  {
    key: 'leverage',
    title: 'Use leverage wisely',
    lines: ['Leverage boosts both profits and losses. At 10x leverage, a 1% move = 10% gain or loss.'],
  },
  {
    key: 'direction',
    title: 'Go long or short',
    lines: ['Think the price will rise? Go long.', "Think it'll fall? Go short.", 'You earn when the market moves in your favor.'],
  },
  {
    key: 'liquidation',
    title: 'Protect your position',
    lines: ['If the market hits your liquidation price, your position closes automatically. Higher leverage = higher risk.'],
  },
  {
    key: 'start',
    title: 'Start trading in minutes',
    lines: [
      '1. Deposit stablecoins or supported tokens (like USDT, BNB, or VWT).',
      '2. Choose a market: BTC, ETH, or any of 100+ pairs.',
      '3. Set your leverage and open your position.',
    ],
  },
];

/** Branded stand-in shown until a step's generated illustration is added. */
function ArtPlaceholder({ dark, index }: { dark: boolean; index: number }) {
  return (
    <View style={[styles.artPlaceholder, { backgroundColor: dark ? '#141A2B' : '#EEF0FB', borderColor: dark ? '#252B45' : '#E1E4F5' }]}>
      <Svg width={96} height={96} viewBox="0 0 96 96">
        <Circle cx="48" cy="48" r="44" fill="none" stroke={VIOLET_DEEP} strokeWidth="2" opacity={0.25} />
        <Path d="M20 48c0-9 7-16 14-16 10 0 14 16 28 16 7 0 14-7 14-16" fill="none" stroke="none" />
        <Path
          d="M28 48c0-7.5 5-12 10.5-12 10 0 10.5 12 19 12s9.5-12 10.5-12M68 48c0 7.5-5 12-10.5 12-10 0-10.5-12-19-12S29 60 28 60"
          fill="none"
          stroke={VIOLET_DEEP}
          strokeWidth="5"
          strokeLinecap="round"
        />
      </Svg>
      <Text style={[styles.artHint, { color: dark ? '#8A8EA3' : '#8E92AA' }]}>{`Step ${index + 1} illustration`}</Text>
    </View>
  );
}

function ProgressBar({ count, current, dark, brand }: { count: number; current: number; dark: boolean; brand: string }) {
  const idle = dark ? '#2A2F45' : '#E3E3E8';
  return (
    <View style={styles.progress} accessibilityLabel={`Step ${current + 1} of ${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          <View style={styles.dotWrap}>
            {i < current ? (
              // done: filled circle with check
              <View style={[styles.dot, { backgroundColor: brand }]}>
                <Svg width={10} height={10} viewBox="0 0 10 10">
                  <Path d="M2.2 5.2l1.9 1.9 3.7-3.9" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
            ) : i === current ? (
              // current: ring with filled core
              <View style={[styles.dot, { backgroundColor: 'transparent', borderWidth: 2, borderColor: brand }]}>
                <View style={[styles.core, { backgroundColor: brand }]} />
              </View>
            ) : (
              <View style={[styles.dot, { backgroundColor: idle }]} />
            )}
          </View>
          {i < count - 1 ? <View style={[styles.link, { backgroundColor: i < current ? brand : idle }]} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

export default function PerpsAboutScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<GuideStep>>(null);
  const [index, setIndex] = useState(0);
  const last = index === GUIDE_STEPS.length - 1;

  const close = useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
  }, [navigation]);

  const goTo = useCallback((i: number) => {
    listRef.current?.scrollToIndex({ index: i, animated: true });
    setIndex(i);
  }, []);

  const onNext = () => (last ? close() : goTo(index + 1));

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(Math.max(0, Math.min(GUIDE_STEPS.length - 1, i)));
  };

  const skipBg = dark ? '#1D2133' : '#F2F2F4';

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 8 }]}>
      <ProgressBar count={GUIDE_STEPS.length} current={index} dark={dark} brand={VIOLET_DEEP} />

      <FlatList
        ref={listRef}
        data={GUIDE_STEPS}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => {
          const art = STEP_ART[i];
          return (
            <View style={{ width }}>
              <View style={styles.copy}>
                <Text style={[styles.title, { color: theme.ink }]}>{item.title}</Text>
                {item.lines.map((l) => (
                  <Text key={l} style={[styles.body, { color: theme.inkMuted }]}>{l}</Text>
                ))}
              </View>
              <View style={styles.art}>
                {art ? (
                  <Image source={art} style={styles.artImg} resizeMode="contain" accessibilityLabel={item.title} />
                ) : (
                  <ArtPlaceholder dark={dark} index={i} />
                )}
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={last ? 'Got it' : 'Next'}
          onPress={onNext}
          style={({ pressed }) => [styles.primary, { backgroundColor: VIOLET_DEEP, opacity: pressed ? 0.88 : 1 }]}
        >
          <Text style={styles.primaryText}>{last ? 'Got it' : 'Next'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip"
          onPress={close}
          style={({ pressed }) => [styles.secondary, { backgroundColor: skipBg, opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[styles.secondaryText, { color: theme.ink }]}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progress: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 18 },
  dotWrap: { alignItems: 'center', justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  core: { width: 6, height: 6, borderRadius: 3 },
  link: { flex: 1, height: 2, marginHorizontal: 3, borderRadius: 1 },
  copy: { paddingHorizontal: 24, paddingTop: 8 },
  title: { fontSize: 28, lineHeight: 34, fontFamily: 'Inter-700', fontWeight: '700', marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, fontFamily: 'Inter-400' },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 20, minHeight: 320 },
  artImg: { width: '100%', height: 360 },
  artPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 380,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  artHint: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500' },
  actions: { paddingHorizontal: 16, gap: 10 },
  primary: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },
  secondary: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },
});
