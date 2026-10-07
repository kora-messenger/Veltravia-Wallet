/**
 * Veltravia Wallet — onboarding entry point.
 *
 * Trust Wallet-style welcome: full-white surface, a swipeable illustration
 * carousel (4 slides), dot indicator, then the two primary CTAs.
 *
 * The illustration slots take either a static PNG (current) or a Lottie
 * source (later) — swap the <Image> for <LottieView> when we have the
 * motion assets and nothing else in this file changes.
 */
import React, { useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

const { width: SCREEN_W } = Dimensions.get('window');

interface Slide {
  image: number; // require() asset id
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
  const { theme } = useTheme();
  const listRef = useRef<FlatList<Slide>>(null);
  const [page, setPage] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (next !== page) setPage(next);
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: '#FFFFFF' }]}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Image source={item.image} style={styles.art} resizeMode="contain" />
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
          style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.6 : 1 }]}
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
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
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
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderColor: '#E4E6F0',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
});
