/**
 * Veltravia Wallet — onboarding entry point.
 *
 * Trust Wallet-style welcome: theme-aware surface (white / deep navy), a swipeable illustration
 * carousel (4 slides), dot indicator, then the two primary CTAs.
 *
 * The illustration slots take either a static PNG (current) or a Lottie
 * source (later) — swap the <Image> for <LottieView> when we have the
 * motion assets and nothing else in this file changes.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

const { width: SCREEN_W } = Dimensions.get('window');

interface Slide {
  image: number; // require() asset id (light theme)
  imageDark?: number; // optional dark-theme variant; falls back to `image`
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    image: require('../../assets/onboarding/slide1.png'),
    title: 'Your keys, your crypto',
    body: 'Veltravia is self-custody. Only you hold the keys — nobody else can touch your wallet.',
  },
  {
    image: require('../../assets/onboarding/slide2.png'),
    title: 'Multi-chain by default',
    body: 'Ethereum, BNB Chain and Polygon in one wallet.',
  },
  {
    image: require('../../assets/onboarding/slide3.png'),
    imageDark: require('../../assets/onboarding/slide3_dark.png'),
    title: 'Markets at a glance',
    body: 'Live prices, trends and portfolio value the moment you open the app.',
  },
  {
    image: require('../../assets/onboarding/slide4.png'),
    title: 'Veltravia AI',
    body: 'An AI assistant for your wallet — ask about tokens, transactions and security.',
  },
];

export default function WelcomeScreen({
  onCreate,
  onImport,
}: {
  /** Phase 2: routes to the seed-reveal + PIN flow. */
  onCreate: () => void;
  /** Phase 2: routes to the recovery-phrase import flow. */
  onImport: () => void;
}) {
  const { theme, isDark } = useTheme();
  const listRef = useRef<FlatList<Slide>>(null);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0); // latest page for the auto-advance timer
  const resumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPauseRef = useRef(false);

  const goTo = useCallback((next: number, animated = true) => {
    pageRef.current = next;
    setPage(next);
    listRef.current?.scrollToIndex({ index: next, animated });
  }, []);

  // Auto-swipe: advance every 3.5s, loop back to the first slide.
  // Pauses while the user drags, resumes 5s after they let go.
  useEffect(() => {
    if (autoPauseRef.current) return;
    const id = setInterval(() => {
      goTo((pageRef.current + 1) % SLIDES.length);
    }, 3500);
    return () => clearInterval(id);
  }, [goTo]);

  useEffect(() => () => {
    if (resumeRef.current) clearTimeout(resumeRef.current);
  }, []);

  const onDragStart = () => {
    autoPauseRef.current = true;
    if (resumeRef.current) clearTimeout(resumeRef.current);
  };

  const onDragEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    pageRef.current = next;
    setPage(next);
    if (resumeRef.current) clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(() => { autoPauseRef.current = false; }, 5000);
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onScrollBeginDrag={onDragStart}
        onMomentumScrollEnd={onDragEnd}
        onScrollEndDrag={onDragEnd}
        extraData={isDark}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Image
              source={isDark && item.imageDark ? item.imageDark : item.image}
              style={styles.art}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: theme.ink }]}>{item.title}</Text>
            <Text style={[styles.body, { color: theme.inkMuted }]}>{item.body}</Text>
          </View>
        )}
        style={styles.carousel}
      />

      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === page ? { backgroundColor: theme.brand, width: 20 } : { backgroundColor: theme.border },
            ]}
          />
        ))}
      </View>

      <View style={styles.ctaWrap}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={onCreate}
        >
          <Text style={styles.primaryBtnText}>Create a new wallet</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, { borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}
          onPress={onImport}
        >
          <Text style={[styles.secondaryBtnText, { color: theme.ink }]}>
            I already have a wallet
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  carousel: { flex: 1 },
  slide: {
    width: SCREEN_W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  art: { width: SCREEN_W * 0.62, height: SCREEN_W * 0.62, marginBottom: 24 },
  title: { fontSize: 28, fontFamily: 'Inter-700', fontWeight: '800', textAlign: 'center', marginBottom: 12, lineHeight: 39 },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 20, fontFamily: 'Inter-400' },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: { height: 8, borderRadius: 999 },
  ctaWrap: { paddingHorizontal: 24, paddingBottom: 16 },
  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  secondaryBtn: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
});
