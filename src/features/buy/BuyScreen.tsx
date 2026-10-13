/**
 * Buy / Sell (Home > Buy). Layout + states measured from Trust's recordings.
 *
 * Loading (as in the 2nd recording):
 *  - EVERY keystroke re-quotes. The crypto amount becomes a grey skeleton bar
 *    AND the Pay-with card becomes a skeleton (avatar + two bars) together,
 *    the Continue button stays disabled. Both resolve at the same time.
 *  - Empty amount: quote shows "-" and the card shows the default provider.
 *  - Outcomes after loading:
 *      ok          crypto amount (muted) + provider card + blue Continue
 *      below_min   red digits, red "Min amount is 1,416 NGN" under the
 *                  header, quote "-", disabled "Correct amount"
 *      no_provider red "No available provider", quote "-", provider card
 *                  faded to 40%, disabled "Continue"
 *  - The amount is RIGHT-aligned against the currency chip and grows left.
 *  - Tapping the card opens the "Pay with" sheet (providers that qualify).
 *  - Continue hands off to the provider's checkout in the browser.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Linking, Pressable, StyleSheet, Text, Vibration, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { SkeletonBlock } from '../../components/Skeleton';
import PrimaryButton from '../../components/PrimaryButton';
import { BackIcon, BackspaceIcon, ChevronRight } from '../../components/icons';
import CoinLogo from '../../components/CoinLogo';
import { showToast } from '../../components/Toast';
import { CURRENCIES } from './currencies';
import { Flag } from './Flag';
import { useBuyQuote } from './useBuyQuote';
import { PROVIDERS, Provider, QuoteStatus } from './providers';
import { ProviderMark } from './ProviderMark';
import PayWithSheet from './PayWithSheet';

type Mode = 'buy' | 'sell';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];
const ERROR_RED = '#B23536';
const DIGIT_RED = '#CF2828';

function groupDigits(raw: string): string {
  if (!raw) return '0';
  const [i, d] = raw.split('.');
  const g = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return d !== undefined ? `${g}.${d}` : g;
}

function Chip({ left, label, onPress }: { left: React.ReactNode; label: string; onPress?: () => void }) {
  const { theme } = useTheme();
  const bg = theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : '#EFEFF3';
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: bg }]}>
      {left}
      <Text style={[styles.chipText, { color: theme.ink }]}>{label}</Text>
      <ChevronRight size={14} color={theme.inkMuted} />
    </Pressable>
  );
}

export default function BuyScreen({ navigation, route }: { navigation: any; route: any }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<Mode>('buy');
  const [amount, setAmount] = useState('');
  const [fiat, setFiat] = useState('USD');
  const crypto = 'ETH';

  // Amount sizing (Trust, measured from a screen recording at 411dp): the digits live in a
  // fixed zone from x=34 to the caret at x~330 (~300dp). The font is the LARGEST step of this
  // ladder whose text still fits that zone, so it shrinks stepwise as digits are added:
  //   70 > 59 > 47 > 42 > 37 > 32.5 > 29 > 27 > 25.5sp (cap heights 50.6/43/34/30/27/23.6/21/19.4/18.6dp)
  // Beyond the last step the text truncates with an ellipsis. Up to 3 digits it is a big ~70sp.
  const { width: winW } = useWindowDimensions();
  const zone = Math.round(winW * (288 / 411)); // zone scales with the screen
  const text = groupDigits(amount);
  const amountFont = (() => {
    const widthAt = (f: number) =>
      [...text].reduce((w, ch) => w + (ch === ',' || ch === '.' ? f * 0.1 : f * 0.54), 0);
    for (const f of [70, 59, 47, 42, 37, 32.5, 29, 27, 25.5]) if (widthAt(f) <= zone) return f;
    return 25.5;
  })();

  // Blinking caret, like Trust's input.
  const cursor = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursor, { toValue: 0, duration: 520, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(cursor, { toValue: 1, duration: 520, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [cursor]);
  const [flagReady, setFlagReady] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [chosen, setChosen] = useState<Provider | null>(null);
  // First open: the card loads once before any amount exists.
  const [bootLoading, setBootLoading] = useState(true);

  const { loading: quoting, quote } = useBuyQuote(amount, fiat, crypto);

  useEffect(() => {
    const t = setTimeout(() => setBootLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  // flag on the chip loads after mount / on currency change
  useEffect(() => {
    setFlagReady(false);
    const t = setTimeout(() => setFlagReady(true), 450);
    return () => clearTimeout(t);
  }, [fiat]);

  // Returning from Select currency
  useEffect(() => {
    const picked = route?.params?.pickedCurrency as string | undefined;
    if (picked) {
      setFiat(picked);
      setChosen(null);
      navigation.setParams({ pickedCurrency: undefined });
    }
  }, [route?.params?.pickedCurrency, navigation]);

  // A new quote resets a manual provider choice that no longer qualifies.
  useEffect(() => {
    if (chosen && quote && !quote.providers.find((p) => p.id === chosen.id)) setChosen(null);
  }, [quote, chosen]);

  const press = useCallback((k: string) => {
    Vibration.vibrate(6);
    setAmount((a) => {
      if (k === 'del') return a.slice(0, -1);
      if (k === '.') return a.includes('.') ? a : (a || '0') + '.';
      if (a === '0') return k;
      if (a.replace('.', '').length >= 10) return a;
      if (a.includes('.') && a.split('.')[1].length >= 2) return a;
      return a + k;
    });
  }, []);

  const cur = CURRENCIES.find((c) => c.code === fiat);
  const hasAmount = !!amount && parseFloat(amount) > 0;
  // The limit comes from the QUOTE, exactly like Trust: the APK carries no per-country
  // constants — typing past the ceiling re-quotes and the answer turns the digits red.
  const status: 'idle' | QuoteStatus = !hasAmount || quoting ? 'idle' : quote?.status ?? 'idle';
  const overMax = status === 'over_max';
  const maxFiat = quote?.maxFiat ?? 0;
  const cardLoading = bootLoading || (hasAmount && quoting);
  const provider: Provider = chosen ?? quote?.best ?? PROVIDERS[PROVIDERS.length - 1];

  const toggleBg = theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : '#EFEFF3';
  const activePill = theme.mode === 'dark' ? 'rgba(255,255,255,0.16)' : '#FFFFFF';
  const muted = theme.inkMuted;

  const errorText = useMemo(() => {
    if (mode !== 'buy') return null;
    if (overMax && maxFiat) return `Max amount is ${groupDigits(String(maxFiat))} ${fiat}`;
    if (status === 'below_min' && quote?.minFiat) return `Min amount is ${groupDigits(String(quote.minFiat))} ${fiat}`;
    if (status === 'no_provider') return 'No available provider';
    return null;
  }, [mode, status, quote, fiat]);

  const canContinue = mode === 'buy' && status === 'ok' && !cardLoading;
  const ctaLabel = status === 'below_min' || status === 'over_max' ? 'Correct amount' : 'Continue';

  const onContinue = () => {
    Linking.openURL(provider.url).catch(() => showToast("Couldn't open the checkout. Try again later.", { kind: 'error' }));
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {/* header */}
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()} style={[styles.back, { backgroundColor: toggleBg }]}>
          <BackIcon size={22} color={theme.ink} />
        </Pressable>
        <View style={[styles.toggle, { backgroundColor: toggleBg }]}>
          {(['buy', 'sell'] as Mode[]).map((m) => {
            const on = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.toggleSeg, on && { backgroundColor: activePill }, on && styles.toggleOn]}
              >
                <Text style={[styles.toggleText, { color: on ? theme.ink : muted }]}>{m === 'buy' ? 'Buy' : 'Sell'}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {mode === 'sell' ? (
        <Text style={styles.errorLine}>You don't have crypto to sell</Text>
      ) : errorText ? (
        <Text style={styles.errorLine}>{errorText}</Text>
      ) : (
        <View style={styles.errorSpacer} />
      )}

      {/* amount area */}
      <View style={[styles.amountArea, errorText || mode === 'sell' ? styles.amountAreaErr : null]}>
        <View style={styles.amountRow}>
          <View style={styles.amountBox}>
            <Text
              style={[
                styles.amount,
                { fontSize: amountFont, lineHeight: Math.round(amountFont * 1.18) },
                { color: status === 'below_min' || status === 'over_max' ? DIGIT_RED : theme.ink },
                mode === 'buy' && !amount && { color: muted },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {groupDigits(amount)}
            </Text>
            <Animated.View
              style={[
                styles.cursor,
                { height: Math.round(amountFont * 0.94), opacity: cursor, backgroundColor: status === 'below_min' || status === 'over_max' ? DIGIT_RED : '#8A7CFB' },
              ]}
            />
          </View>
          {mode === 'buy' ? (
            <Chip
              left={<Flag code={cur?.flag ?? null} size={20} ready={flagReady} />}
              label={fiat}
              onPress={() => navigation.navigate('SelectCurrency', { selected: fiat })}
            />
          ) : (
            <Chip left={<CoinLogo symbol="BTC" size={22} />} label="BTC" />
          )}
        </View>

        <View style={styles.subRow}>
          {mode === 'buy' ? (
            <>
              {hasAmount && quoting ? (
                <SkeletonBlock style={styles.quoteSk} />
              ) : status === 'ok' ? (
                <Text style={[styles.quote, { color: muted }]}>{quote?.cryptoAmount}</Text>
              ) : (
                <View style={[styles.dash, { backgroundColor: '#83869C' }]} />
              )}
              <Chip left={<CoinLogo symbol={crypto} size={22} />} label={crypto} />
            </>
          ) : (
            <>
              <Text style={[styles.quote, { color: muted }]}>0</Text>
              <Chip left={null} label="USD" />
            </>
          )}
        </View>
      </View>

      {/* pay-with card (buy) / percentage slider (sell) */}
      {mode === 'buy' ? (
        <Pressable
          disabled={cardLoading || status !== 'ok'}
          onPress={() => setPayOpen(true)}
          style={[styles.payCard, { backgroundColor: toggleBg }, status === 'no_provider' && { opacity: 0.4 }]}
        >
          {cardLoading ? (
            <>
              <SkeletonBlock style={styles.paySkAvatar} />
              <View style={{ flex: 1, gap: 7 }}>
                <SkeletonBlock style={styles.paySkA} />
                <SkeletonBlock style={styles.paySkB} />
              </View>
            </>
          ) : (
            <>
              <ProviderMark provider={provider} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.payLabel, { color: muted }]}>Pay with</Text>
                <Text style={[styles.payValue, { color: theme.ink }]}>{provider.name}</Text>
              </View>
              <ChevronRight size={18} color={muted} />
            </>
          )}
        </Pressable>
      ) : (
        <View style={styles.sliderWrap}>
          <View style={[styles.sliderTrack, { backgroundColor: toggleBg }]}>
            <View style={styles.sliderKnob} />
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.sliderDot, { left: `${i * 25}%`, backgroundColor: muted }]} />
            ))}
          </View>
        </View>
      )}

      {/* numpad */}
      <View style={styles.pad}>
        {KEYS.map((k) => (
          <Pressable key={k} style={styles.key} onPress={() => press(k)} hitSlop={2}>
            {k === 'del' ? <BackspaceIcon size={28} color={theme.ink} /> : <Text style={[styles.keyText, { color: theme.ink }]}>{k}</Text>}
          </Pressable>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.cta}>
        {mode === 'sell' ? (
          <View style={[styles.ctaDisabled, { backgroundColor: toggleBg }]}>
            <Text style={[styles.ctaDisabledText, { color: muted }]}>Buy crypto first</Text>
          </View>
        ) : canContinue ? (
          <PrimaryButton label="Continue" height={56} arrow={false} onPress={onContinue} />
        ) : (
          <View style={[styles.ctaDisabled, { backgroundColor: toggleBg }]}>
            <Text style={[styles.ctaDisabledText, { color: muted }]}>{ctaLabel}</Text>
          </View>
        )}
      </View>

      <PayWithSheet
        visible={payOpen}
        providers={quote?.providers ?? PROVIDERS}
        selectedId={provider.id}
        fiat={fiat}
        fiatFlag={cur?.flag ?? null}
        onPick={setChosen}
        onClose={() => setPayOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, gap: 22 },
  back: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  toggle: { flex: 1, height: 46, borderRadius: 23, flexDirection: 'row', padding: 3, marginRight: 7 },
  toggleSeg: { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  toggleText: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },
  errorLine: { color: ERROR_RED, fontSize: 13, lineHeight: 18, fontFamily: 'Inter-600', fontWeight: '600', textAlign: 'center', marginTop: 4 },
  errorSpacer: { height: 22 },
  amountArea: { marginTop: 46, paddingHorizontal: 17 },
  amountAreaErr: { marginTop: 56 },
  amountRow: { flexDirection: 'row', alignItems: 'center', height: 96, gap: 12 },
  amountBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 2 },
  amount: { fontFamily: 'Inter-700', fontWeight: '700', textAlign: 'right' },
  cursor: { width: 2, borderRadius: 1, marginLeft: 3 },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, height: 47, marginTop: 4 },
  quote: { fontSize: 18, fontFamily: 'Inter-500', fontWeight: '500' },
  quoteSk: { width: 160, height: 36, borderRadius: 6 },
  dash: { width: 24, height: 3, borderRadius: 1.5 },
  chip: { height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  chipText: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },
  payCard: { marginHorizontal: 17, height: 68, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 14, marginTop: 'auto' },
  payLabel: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500' },
  payValue: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 2 },
  paySkAvatar: { width: 52, height: 52, borderRadius: 26 },
  paySkA: { width: 88, height: 12, borderRadius: 4 },
  paySkB: { width: 150, height: 14, borderRadius: 4 },
  sliderWrap: { marginHorizontal: 17, marginTop: 'auto', height: 28, justifyContent: 'center' },
  sliderTrack: { height: 24, borderRadius: 12, justifyContent: 'center' },
  sliderKnob: { position: 'absolute', left: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#C9C6F7' },
  sliderDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, marginLeft: -3 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, paddingHorizontal: 8 },
  key: { width: '33.333%', height: 68, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 26, fontFamily: 'Inter-700', fontWeight: '700' },
  cta: { paddingHorizontal: 17, paddingTop: 6, paddingBottom: 12 },
  ctaDisabled: { height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  ctaDisabledText: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
});
