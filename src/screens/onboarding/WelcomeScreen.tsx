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
  Linking,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

const { width: SCREEN_W } = Dimensions.get('window');

// Legal pages (placeholder host until the real domain is live; change here only).
const LEGAL = {
  terms: 'https://veltravia.app/terms',
  privacy: 'https://veltravia.app/privacy',
};
const openLegal = (url: string) => Linking.openURL(url).catch(() => {});

interface Slide {
  image: number; // require() asset id (light theme)
  imageDark?: number; // optional dark-theme variant; falls back to `image`
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    image: require('../../assets/onboarding/slide1.png'),
    imageDark: require('../../assets/onboarding/slide1_dark.png'),
    title: 'Your keys, your crypto',
    body: 'Veltravia is self-custody. Only you hold the keys — nobody else can touch your wallet.',
  },
  {
    image: require('../../assets/onboarding/slide2.png'),
    imageDark: require('../../assets/onboarding/slide2_dark.png'),
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
    imageDark: require('../../assets/onboarding/slide4_dark.png'),
    title: 'Veltravia AI',
    body: 'An AI assistant for your wallet — ask about tokens, transactions and security.',
  },
];

export default function WelcomeScreen({
  onCreate,
  onImport,
  autoLoadFor,
  onAutoLoadDone,
}: {
  /**
   * When set, the screen mounts already "loading" for 2s on the matching
   * button, then calls onAutoLoadDone. Used on the return from the
   * passcode screen: the buttons spin again, then the account is created.
   */
  autoLoadFor?: 'create' | 'import' | null;
  onAutoLoadDone?: (which: 'create' | 'import') => void;
  /** Phase 2: routes to the seed-reveal + PIN flow. */
  onCreate: () => void;
  /** Phase 2: routes to the recovery-phrase import flow. */
  onImport: () => void;
}) {
  const { theme, isDark } = useTheme();
  const dark = theme.mode === 'dark';
  const [loading, setLoading] = useState<'create' | 'import' | null>(autoLoadFor ?? null);
  const LOAD_MS = 2000;

  // Return from passcode: keep spinning for 2s, then finish account creation.
  useEffect(() => {
    if (!autoLoadFor) return;
    const t = setTimeout(() => onAutoLoadDone?.(autoLoadFor), LOAD_MS);
    return () => clearTimeout(t);
  }, [autoLoadFor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap: both buttons lock + spin for 2s, then the passcode screen opens.
  const start = useCallback(
    (which: 'create' | 'import') => {
      if (loading) return;
      setLoading(which);
      setTimeout(() => {
        (which === 'create' ? onCreate : onImport)();
        // release after the next screen has covered us
        setTimeout(() => setLoading(null), 400);
      }, LOAD_MS);
    },
    [loading, onCreate, onImport],
  );
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
        {/* Create a wallet: full-pill, brand purple-to-blue gradient */}
        <Pressable
          onPress={() => start('create')}
          disabled={!!loading}
          style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <LinearGradient
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            colors={theme.brandGradient as unknown as [string, string]}
            style={styles.primaryGradient}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Create a wallet</Text>
            )}
          </LinearGradient>
        </Pressable>

        {/* I already have a wallet: plain text, no border or fill */}
        <Pressable
          onPress={() => start('import')}
          disabled={!!loading}
          style={({ pressed }) => [
            styles.secondaryBtn,
            { backgroundColor: dark ? 'rgba(108,99,255,0.24)' : 'rgba(108,99,255,0.12)', opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={theme.ink} />
          ) : (
            <Text style={[styles.secondaryBtnText, { color: theme.ink }]}>I already have a wallet</Text>
          )}
        </Pressable>

        {/* Legal line */}
        <Text style={[styles.legal, { color: theme.inkMuted }]}>
          By using this app, you accept our{' '}
          <Text style={[styles.legalLink, { color: dark ? '#8F89FF' : theme.brand }]} onPress={() => openLegal(LEGAL.terms)}>
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text style={[styles.legalLink, { color: dark ? '#8F89FF' : theme.brand }]} onPress={() => openLegal(LEGAL.privacy)}>
            Privacy Policy
          </Text>
          .
        </Text>
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
  primaryBtn: { height: 58, borderRadius: 29, overflow: 'hidden', marginBottom: 16 },
  primaryGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  secondaryBtn: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  legal: { fontSize: 12, lineHeight: 18, textAlign: 'center', fontFamily: 'Inter-500', paddingHorizontal: 8, marginTop: 16 },
  legalLink: { fontFamily: 'Inter-700', fontWeight: '700' },
});
