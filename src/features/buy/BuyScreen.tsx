/**
 * Buy / Sell (Home > Buy). Layout measured from Trust's recording (411dp):
 *
 *   header      back circle 46dp + Buy|Sell pill (x86-325, h~46) at y37
 *   BUY         amount (Title 56 Bold, left) + fiat chip (NGN >) on one row
 *               at y208-283, crypto row (value / grey skeleton bar + ETH >)
 *               under it at y300-347
 *   pay card    y469-537, 68dp, "Pay with / Bank Transfer >"
 *   numpad      4 rows, 68dp pitch, 22dp bold glyphs, backspace bottom-right
 *   Continue    y820-880, 60dp, disabled until a quote exists
 *   SELL        red "You don't have crypto to sell" (y109), BTC + USD chips,
 *               5-stop percentage slider (y478-495), "Buy crypto first"
 *
 * Skeletons (as in the recording): the crypto amount is a grey bar and the
 * Pay-with card is a grey avatar + two bars until each resolves.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { SkeletonBlock } from '../../components/Skeleton';
import PrimaryButton from '../../components/PrimaryButton';
import { BackIcon, BackspaceIcon, ChevronRight } from '../../components/icons';
import CoinLogo from '../../components/CoinLogo';
import { CURRENCIES } from './currencies';
import { Flag } from './Flag';
import { useBuyQuote, usePaymentMethod } from './useRates';
import { showToast } from '../../components/Toast';
import Svg, { Path } from 'react-native-svg';

type Mode = 'buy' | 'sell';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

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
  const [crypto] = useState('ETH');
  const [flagReady, setFlagReady] = useState(false);

  const { loading: quoteLoading, cryptoAmount } = useBuyQuote(amount, fiat, crypto);
  const pay = usePaymentMethod();

  // The chip flag loads in after the screen mounts (grey disc -> flag).
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
      navigation.setParams({ pickedCurrency: undefined });
    }
  }, [route?.params?.pickedCurrency, navigation]);

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
  const canContinue = mode === 'buy' && !!amount && parseFloat(amount) > 0 && !quoteLoading;
  const toggleBg = theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : '#EFEFF3';
  const activePill = theme.mode === 'dark' ? 'rgba(255,255,255,0.16)' : '#FFFFFF';
  const muted = theme.inkMuted;

  const openCurrency = () => navigation.navigate('SelectCurrency', { selected: fiat });

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
                <Text style={[styles.toggleText, { color: on ? theme.ink : muted }]}>
                  {m === 'buy' ? 'Buy' : 'Sell'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {mode === 'sell' ? <Text style={styles.sellError}>You don't have crypto to sell</Text> : null}

      {/* amount area */}
      <View style={styles.amountArea}>
        <View style={styles.amountRow}>
          <Text
            style={[styles.amount, { color: theme.ink }, mode === 'buy' && !amount && { color: muted }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {groupDigits(amount)}
          </Text>
          {mode === 'buy' ? (
            <Chip
              left={<Flag code={cur?.flag ?? null} size={20} ready={flagReady} />}
              label={fiat}
              onPress={openCurrency}
            />
          ) : (
            <Chip left={<CoinLogo symbol="BTC" size={22} />} label="BTC" />
          )}
        </View>

        <View style={styles.subRow}>
          {mode === 'buy' ? (
            <>
              {quoteLoading ? (
                <SkeletonBlock style={styles.quoteSk} />
              ) : (
                <Text style={[styles.quote, { color: muted }]}>{cryptoAmount}</Text>
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
        <View style={[styles.payCard, { backgroundColor: toggleBg }]}>
          {pay.loading ? (
            <>
              <SkeletonBlock style={styles.paySkAvatar} />
              <View style={{ flex: 1, gap: 7 }}>
                <SkeletonBlock style={styles.paySkA} />
                <SkeletonBlock style={styles.paySkB} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.bank}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.payLabel, { color: muted }]}>Pay with</Text>
                <Text style={[styles.payValue, { color: theme.ink }]}>{pay.label}</Text>
              </View>
              <ChevronRight size={18} color={muted} />
            </>
          )}
        </View>
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
            {k === 'del' ? (
              <BackspaceIcon size={28} color={theme.ink} />
            ) : (
              <Text style={[styles.keyText, { color: theme.ink }]}>{k}</Text>
            )}
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
          <PrimaryButton
            label="Continue"
            height={56}
            arrow={false}
            onPress={() => showToast('Onramp checkout arrives with the payment provider integration.', { kind: 'info', duration: 2600 })}
          />
        ) : (
          <View style={[styles.ctaDisabled, { backgroundColor: toggleBg }]}>
            <Text style={[styles.ctaDisabledText, { color: muted }]}>Continue</Text>
          </View>
        )}
      </View>
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
  sellError: { color: '#B53332', fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', textAlign: 'center', marginTop: 14 },
  amountArea: { marginTop: 56, paddingHorizontal: 17 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 75, gap: 12 },
  amount: { flex: 1, fontSize: 60, lineHeight: 72, fontFamily: 'Inter-700', fontWeight: '700' },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, height: 47, marginTop: 6 },
  quote: { fontSize: 18, fontFamily: 'Inter-500', fontWeight: '500' },
  quoteSk: { width: 160, height: 22, borderRadius: 6 },
  chip: { height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  chipText: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },
  payCard: { marginHorizontal: 17, height: 68, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 14, marginTop: 'auto' },
  bank: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#0A3A94', alignItems: 'center', justifyContent: 'center' },
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
