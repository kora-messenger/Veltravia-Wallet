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
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  StatusBar,
} from 'react-native';
import { openInBrowser } from '../../services/browserState';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { takeRemovalNotice } from '../../core/security/deviceRemoval';
import { checkOnline, offlineMessage } from '../../services/connectivity';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';

const { width: SCREEN_W } = Dimensions.get('window');

// Legal pages (placeholder host until the real domain is live; change here only).
const LEGAL = {
  terms: 'https://veltravia.app/terms',
  privacy: 'https://veltravia.app/privacy',
};
const openLegal = (url: string) => { openInBrowser(url); };

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

/**
 * Why setting up the wallet did not finish, in words the user can act on.
 * The keystore refuses to store a seed when the phone has no biometrics
 * enrolled, which is by far the most common cause on a new device.
 */
export function setupFailureMessage(reason: unknown): string {
  if (reason === 'timeout') return "That took too long to finish. Try again.";
  const text = String((reason as any)?.message ?? reason ?? '');
  if (/biometr|biometric|enrol|not available|keychain|keystore|secure\s*hardware/i.test(text)) {
    return 'This phone needs a screen lock with a fingerprint or face unlock before a wallet can be stored securely. Turn that on in your phone settings, then try again.';
  }
  return "Couldn't finish setting up your wallet. Try again.";
}

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
  /**
   * Resolve `true` when the account really exists (the navigator moves on),
   * `false`/throw when it does not. Returning nothing counts as success, so the
   * 'import' branch that only navigates stays unchanged.
   */
  onAutoLoadDone?: (which: 'create' | 'import') => boolean | void | Promise<boolean | void>;
  /** Phase 2: routes to the seed-reveal + PIN flow. */
  onCreate: () => void;
  /** Phase 2: routes to the recovery-phrase import flow. */
  onImport: () => void;
}) {
  const { theme, isDark } = useTheme();
  const dark = theme.mode === 'dark';
  const [loading, setLoading] = useState<'create' | 'import' | null>(autoLoadFor ?? null);
  // Set when this device was unlinked: say why the wallet is gone.
  const [removed] = useState(() => takeRemovalNotice());
  // Both CTAs need the network: say so here instead of half-starting a flow.
  const [netNote, setNetNote] = useState<string | null>(null);
  // The underlying error, shown small under the message: a screenshot of it is
  // enough to diagnose a device we cannot inspect.
  const [setupReason, setSetupReason] = useState<string | null>(null);
  const LOAD_MS = 2000;
  /** A creation that has not finished by now is treated as failed, not hung. */
  const ACCOUNT_TIMEOUT_MS = 25000;

  // Return from passcode: keep spinning for 2s, then finish account creation.
  //
  // A failed or hanging creation used to leave both buttons spinning forever
  // with no message and no way forward (Ijezie hit exactly that on 6 Nov 2026
  // after typing his passcode). Now: success hands over to the next screen as
  // before, failure stops the spinners, says what to do, and leaves the buttons
  // usable so the tap path is a retry.
  useEffect(() => {
    if (!autoLoadFor) return;
    let cancelled = false;
    const giveUp = (reason: unknown) => {
      if (cancelled) return;
      setLoading(null);
      setNetNote(setupFailureMessage(reason));
      const raw = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '';
      setSetupReason(raw && raw !== 'timeout' ? raw : null);
    };
    const t = setTimeout(() => {
      const work = Promise.resolve(onAutoLoadDone?.(autoLoadFor))
        // ONLY `false` means "no account". Anything else (including undefined,
        // which the navigator's import branch returns) is a success.
        .then((v) => (v === false ? 'failed' : 'ok'))
        .catch((e: unknown) => e as Error);
      const slow = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ACCOUNT_TIMEOUT_MS));
      Promise.race([work, slow]).then((res) => {
        if (res === 'ok') return; // success: the next screen covers us
        giveUp(res);
      }, giveUp);
    }, LOAD_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [autoLoadFor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap: both buttons lock + spin for 2s, then the passcode screen opens.
  const start = useCallback(
    (which: 'create' | 'import') => {
      if (loading) return;
      setNetNote(null);
      setSetupReason(null);
      setLoading(which);
      (async () => {
        // Network first: creating or restoring an account cannot work offline,
        // and a flow that dies halfway leaves the user with a passcode and no
        // account. Refuse to start instead.
        const net = await checkOnline();
        if (!net.online) {
          setLoading(null);
          setNetNote(offlineMessage(net.reason));
          return;
        }
        setTimeout(() => {
          (which === 'create' ? onCreate : onImport)();
          // release after the next screen has covered us
          setTimeout(() => setLoading(null), 400);
        }, LOAD_MS);
      })();
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
      {removed && (
        <View style={[styles.removedBanner, { borderColor: theme.border, backgroundColor: theme.surface }]} testID="unlinkedNotice">
          <Text style={[styles.removedTitle, { color: theme.ink }]}>This device was unlinked</Text>
          <Text style={[styles.removedBody, { color: theme.inkMuted }]}>
            It was removed from your wallet from another device, so the wallet was deleted here. Import it with your
            recovery phrase to use it again.
          </Text>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        // Slides are exactly one screen wide, so the list can compute offsets
        // itself. Without this, the auto-advance's scrollToIndex throws
        // "Invariant Violation" whenever the list has not measured yet.
        getItemLayout={(_d, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
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
        {/* Create a wallet: animated 3D slab button (client-approved effect) */}
        <PrimaryButton
          label="Create a wallet"
          onPress={() => start('create')}
          loading={!!loading}
          height={52}
          style={{ marginBottom: 12 }}
        />

        {/* I already have a wallet: plain text, no border or fill */}
        <SecondaryButton label="I already have a wallet" onPress={() => start('import')} loading={!!loading} height={52} />

        {/* Offline: the two buttons above did not start a flow, and this says why. */}
        {netNote ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="welcomeNetNote"
            style={[styles.netNote, { color: '#E5484D' }]}
          >
            {netNote}
          </Text>
        ) : null}
        {netNote && setupReason ? (
          <Text testID="welcomeSetupReason" style={[styles.netReason, { color: theme.inkMuted }]}>
            {setupReason}
          </Text>
        ) : null}

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
  removedBanner: { marginHorizontal: 20, marginTop: 12, padding: 14, borderWidth: 1, borderRadius: 14, gap: 4 },
  removedTitle: { fontSize: 14.5, fontWeight: '700' },
  removedBody: { fontSize: 12.5, lineHeight: 18 },
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
  netReason: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: 'Inter-400',
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  netNote: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
  },
  legal: { fontSize: 12, lineHeight: 18, textAlign: 'center', fontFamily: 'Inter-500', paddingHorizontal: 8, marginTop: 16 },
  legalLink: { fontFamily: 'Inter-700', fontWeight: '700' },
});
