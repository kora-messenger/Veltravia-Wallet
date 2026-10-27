/**
 * Veltravia Wallet — Perps Withdraw sheet (Trust parity).
 *
 * A tall bottom sheet over the Perps screen (dimmed header visible above it):
 *   X + "Withdraw", the typed amount, "Withdraw from <provider>" and
 *   "Receive <USDC on network>" rows, a percent slider over the selected
 *   provider's balance, an in-sheet keypad and a "Slide to Withdraw" control.
 *
 * Balances are held per provider (Hyperliquid, Aster). Typing more than the
 * selected provider holds shows a red "Not enough balance" and keeps the slide
 * locked; a provider with nothing trips it on the first digit, so the user
 * switches "Withdraw from" to the provider that has the money.
 *
 * Sub-views inside the same sheet: Select provider, Select network.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, PanResponder, Animated, useWindowDimensions, type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { useWallets } from '../wallets/WalletsProvider';
import {
  CloseIcon, BackIcon, BackspaceIcon, ChevronRight, CheckIcon,
  CoinUsdt, CoinEth, CoinBnb, CoinPolygon, CoinSolana, NetArbitrum, NetBase, NetOptimism, NetAvalanche,
} from '../components/icons';
import { HyperliquidTile, AsterTile } from '../components/PerpsVenueMarks';
import { showToast } from '../components/Toast';
import {
  usePerpsAccount, withdrawFromPerps, PERPS_PROVIDERS, type PerpsProviderId,
} from '../services/perpsAccount';
import {
  WITHDRAW_NETWORKS, DEFAULT_NETWORK, PERCENT_STOPS, pressKey, parseAmount, amountForPercent,
  percentForAmount, withdrawState, type WithdrawNetworkId,
} from '../services/perpsWithdraw';

const VIOLET_DEEP = '#5147E6';
const RED = '#D63232';
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usdc = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;

const NET_ICON: Record<WithdrawNetworkId, React.ComponentType<{ size?: number }>> = {
  arbitrum: NetArbitrum, ethereum: CoinEth, base: NetBase, optimism: NetOptimism,
  bnb: CoinBnb, polygon: CoinPolygon, avalanche: NetAvalanche, solana: CoinSolana,
};
const netName = (id: WithdrawNetworkId) => WITHDRAW_NETWORKS.find((n) => n.id === id)!.name;
const ProviderMark = ({ id, size }: { id: PerpsProviderId; size: number }) =>
  id === 'hyperliquid' ? <HyperliquidTile size={size} /> : <AsterTile size={size} />;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

/* ------------------------------ percent slider ----------------------------- */
function PercentSlider({
  percent, onChange, dark, disabled,
}: { percent: number; onChange: (p: number) => void; dark: boolean; disabled: boolean }) {
  const [w, setW] = useState(0);
  const [dragging, setDragging] = useState(false);
  const wRef = useRef(0);
  const cbRef = useRef(onChange);
  cbRef.current = onChange;
  const THUMB = 28;

  const toPercent = (x: number) => {
    const span = Math.max(1, wRef.current - THUMB);
    const raw = Math.max(0, Math.min(100, ((x - THUMB / 2) / span) * 100));
    // snap to a stop when close, else free percent
    const near = PERCENT_STOPS.find((s) => Math.abs(s - raw) < 4);
    return near ?? Math.round(raw);
  };

  const pan = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (e) => { setDragging(true); cbRef.current(toPercent(e.nativeEvent.locationX)); },
      onPanResponderMove: (e) => cbRef.current(toPercent(e.nativeEvent.locationX)),
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    }),
    [disabled],
  );

  const onLayout = (e: LayoutChangeEvent) => { wRef.current = e.nativeEvent.layout.width; setW(e.nativeEvent.layout.width); };
  const span = Math.max(0, w - THUMB);
  const left = (percent / 100) * span;
  const track = dark ? '#252A3D' : '#ECECF0';

  return (
    <View style={styles.sliderWrap}>
      <View accessibilityLabel={`Withdraw ${percent} percent`} onLayout={onLayout} style={styles.sliderHit} {...pan.panHandlers}>
        <View style={[styles.sliderTrack, { backgroundColor: track }]} pointerEvents="none">
          <View style={[styles.sliderFill, { width: left + THUMB / 2, backgroundColor: disabled ? track : VIOLET_DEEP }]} />
        </View>
        {PERCENT_STOPS.slice(1, 4).map((s) => (
          <View key={s} pointerEvents="none" style={[styles.stopDot, { left: THUMB / 2 + (s / 100) * span - 3, backgroundColor: percent >= s && !disabled ? '#FFFFFF' : dark ? '#4A5070' : '#C7C7CF' }]} />
        ))}
        <View pointerEvents="none" style={[styles.thumb, { left, borderColor: dark ? '#2A2F45' : '#E4E4EA' }]} />
        {dragging && !disabled ? (
          <View pointerEvents="none" style={[styles.bubble, { left: Math.max(0, Math.min(w - 44, left + THUMB / 2 - 22)), backgroundColor: dark ? '#252A3D' : '#EFEFF3' }]}>
            <Text style={[styles.bubbleText, { color: dark ? '#C9CCE0' : '#6E7282' }]}>{percent}%</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------- slide button ------------------------------ */
function SlideToWithdraw({ enabled, onComplete, dark }: { enabled: boolean; onComplete: () => void; dark: boolean }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;
  const wRef = useRef(0);
  const KNOB = 52;

  const pan = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => enabledRef.current,
      onMoveShouldSetPanResponder: () => enabledRef.current,
      onPanResponderMove: (_e, g) => x.setValue(Math.max(0, Math.min(wRef.current - KNOB - 8, g.dx))),
      onPanResponderRelease: (_e, g) => {
        const end = wRef.current - KNOB - 8;
        if (enabledRef.current && g.dx >= end * 0.85) {
          Animated.timing(x, { toValue: end, duration: 90, useNativeDriver: true }).start(() => {
            doneRef.current();
            x.setValue(0);
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
    [x],
  );

  const bg = enabled ? VIOLET_DEEP : dark ? '#1D2133' : '#EEEEF3';
  const knobBg = enabled ? '#FFFFFF' : dark ? '#2A2F45' : '#E3E3EA';
  return (
    <View
      accessibilityLabel="Slide to Withdraw"
      accessibilityState={{ disabled: !enabled }}
      style={[styles.slide, { backgroundColor: bg }]}
      onLayout={(e) => { wRef.current = e.nativeEvent.layout.width; setW(e.nativeEvent.layout.width); }}
    >
      <Text style={[styles.slideText, { color: enabled ? '#FFFFFF' : dark ? '#5A6080' : '#B5B7C6' }]}>Slide to Withdraw</Text>
      <Animated.View {...pan.panHandlers} style={[styles.knob, { backgroundColor: knobBg, transform: [{ translateX: x }] }]}>
        <ChevronRight size={22} color={enabled ? VIOLET_DEEP : dark ? '#5A6080' : '#A9ABBB'} strokeWidth={2.4} />
      </Animated.View>
    </View>
  );
}

/* --------------------------------- screen ---------------------------------- */
type View_ = 'main' | 'provider' | 'network';

export default function PerpsWithdrawScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { height } = useWindowDimensions();
  const { activeWallet } = useWallets();
  const account = usePerpsAccount(activeWallet.id);

  // Start on the provider that actually holds money (Hyperliquid first on ties).
  const firstFunded = PERPS_PROVIDERS.find((p) => account.byProvider[p.id] > 0)?.id ?? 'hyperliquid';
  const [provider, setProvider] = useState<PerpsProviderId>(firstFunded);
  const [network, setNetwork] = useState<WithdrawNetworkId>(DEFAULT_NETWORK);
  const [text, setText] = useState('');
  const [view, setView] = useState<View_>('main');

  const balance = account.byProvider[provider];
  const amount = parseAmount(text);
  const state = withdrawState(balance, amount);
  const percent = percentForAmount(balance, amount);

  const close = () => navigation.goBack();
  const complete = () => {
    if (state !== 'ready') return;
    if (!withdrawFromPerps(activeWallet.id, amount, provider)) return;
    showToast(`Withdrew ${usd(amount)} to wallet`, { kind: 'success' });
    close();
  };

  const surface = dark ? '#12141F' : '#FDFDFE';
  const circleBg = dark ? '#1D2133' : '#EEEEF0';
  const muted = theme.inkMuted;
  const sheetH = height - insets.top - 56;

  /* ----- sub views ----- */
  const subHeader = (title: string) => (
    <View style={styles.headRow}>
      <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => setView('main')} style={[styles.circle, { backgroundColor: circleBg }]}>
        <BackIcon size={22} color={theme.ink} />
      </Pressable>
      <Text style={[styles.headTitle, { color: theme.ink }]}>{title}</Text>
      <View style={styles.circle} />
    </View>
  );

  let body: React.ReactNode;
  if (view === 'provider') {
    body = (
      <>
        {subHeader('Select provider')}
        <View style={[styles.card, { backgroundColor: dark ? '#191C2B' : '#F1F1F4' }]}>
          {PERPS_PROVIDERS.map((p) => {
            const bal = account.byProvider[p.id];
            const funded = bal > 0;
            return (
              <Pressable
                key={p.id}
                accessibilityLabel={`Provider ${p.name}`}
                onPress={() => { setProvider(p.id); setText(''); setView('main'); }}
                style={styles.provRow}
              >
                <View style={{ opacity: funded ? 1 : 0.45 }}><ProviderMark id={p.id} size={46} /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.provName, { color: funded ? theme.ink : muted }]}>{p.name}</Text>
                  <Text style={[styles.provBal, { color: muted }]}>{usd(bal)}</Text>
                </View>
                <View style={[styles.radio, { borderColor: provider === p.id ? VIOLET_DEEP : dark ? '#4A5070' : '#C7C7CF' }]}>
                  {provider === p.id ? <View style={[styles.radioDot, { backgroundColor: VIOLET_DEEP }]} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  } else if (view === 'network') {
    body = (
      <>
        {subHeader('Select network')}
        <Text style={[styles.netNote, { color: muted }]}>We'll deposit USDC to your wallet based on the network selected</Text>
        {WITHDRAW_NETWORKS.map((n) => {
          const Icon = NET_ICON[n.id];
          return (
            <Pressable key={n.id} accessibilityLabel={`Network ${n.name}`} onPress={() => { setNetwork(n.id); setView('main'); }} style={styles.netRow}>
              <View style={styles.netIcon}><Icon size={54} /></View>
              <Text style={[styles.netName, { color: theme.ink }]}>{n.name}</Text>
              {network === n.id ? <CheckIcon size={20} color={VIOLET_DEEP} /> : null}
            </Pressable>
          );
        })}
      </>
    );
  } else {
    body = (
      <>
        <View style={styles.headRow}>
          <Pressable accessibilityLabel="Close" hitSlop={10} onPress={close} style={[styles.circle, { backgroundColor: circleBg }]}>
            <CloseIcon size={22} color={theme.ink} />
          </Pressable>
          <Text style={[styles.headTitle, { color: theme.ink }]}>Withdraw</Text>
          <View style={styles.circle} />
        </View>

        {/* amount */}
        <View style={styles.amountBlock}>
          <Text accessibilityLabel="Not enough balance" style={[styles.errText, { opacity: state === 'insufficient' ? 1 : 0 }]}>Not enough balance</Text>
          <Text accessibilityLabel="Amount" style={[styles.amount, { color: text ? theme.ink : dark ? '#4A5070' : '#C9CBD6' }]}>{text || '0'}</Text>
          <Text style={[styles.amountSub, { color: muted }]}>{`≈ ${usd(amount)}`}</Text>
        </View>

        {/* rows */}
        <Pressable accessibilityLabel="Withdraw from" onPress={() => setView('provider')} style={styles.row}>
          <Text style={[styles.rowLabel, { color: muted }]}>Withdraw from</Text>
          <View style={styles.rowRight}>
            <View style={styles.rowRightText}>
              <View style={styles.inline}>
                <ProviderMark id={provider} size={22} />
                <Text style={[styles.rowValue, { color: theme.ink }]}>{PERPS_PROVIDERS.find((p) => p.id === provider)!.name}</Text>
              </View>
              <Text style={[styles.rowSub, { color: muted }]}>{usdc(balance)}</Text>
            </View>
            <ChevronRight size={20} color={muted} />
          </View>
        </Pressable>
        <Pressable accessibilityLabel="Receive" onPress={() => setView('network')} style={styles.row}>
          <Text style={[styles.rowLabel, { color: muted }]}>Receive</Text>
          <View style={styles.rowRight}>
            <View style={styles.rowRightText}>
              <View style={styles.inline}>
                <CoinUsdt size={22} />
                <Text style={[styles.rowValue, { color: theme.ink }]}>USDC</Text>
              </View>
              <Text style={[styles.rowSub, { color: muted }]}>{netName(network)}</Text>
            </View>
            <ChevronRight size={20} color={muted} />
          </View>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: dark ? '#222639' : '#ECECF0' }]} />
        <PercentSlider
          percent={percent}
          dark={dark}
          disabled={!(balance > 0)}
          onChange={(p) => setText(amountForPercent(balance, p))}
        />

        {/* keypad */}
        <View style={styles.pad}>
          {KEYS.map((k) => (
            <Pressable
              key={k}
              accessibilityLabel={k === 'back' ? 'Backspace' : `Key ${k}`}
              onPress={() => setText((t) => pressKey(t, k))}
              style={styles.padKey}
            >
              {k === 'back' ? <BackspaceIcon size={26} color={theme.ink} /> : <Text style={[styles.padText, { color: theme.ink }]}>{k}</Text>}
            </Pressable>
          ))}
        </View>

        <View style={{ paddingBottom: Math.max(insets.bottom, 14), paddingHorizontal: 16 }}>
          <SlideToWithdraw enabled={state === 'ready'} onComplete={complete} dark={dark} />
        </View>
      </>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={close} />
      <View style={[styles.sheet, { backgroundColor: surface, height: sheetH }]}>
        <View style={[styles.grab, { backgroundColor: dark ? '#3A4060' : '#C9C9D1' }]} />
        {body}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 8, marginBottom: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  amountBlock: { alignItems: 'center', paddingTop: 18, paddingBottom: 18 },
  errText: { color: RED, fontSize: 15, fontFamily: 'Inter-500', fontWeight: '500', marginBottom: 10 },
  amount: { fontSize: 56, lineHeight: 64, fontFamily: 'Inter-700', fontWeight: '700' },
  amountSub: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  rowLabel: { fontSize: 16, fontFamily: 'Inter-500', fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowRightText: { alignItems: 'flex-end' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },
  rowSub: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginTop: 8 },
  sliderWrap: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 },
  sliderHit: { height: 36, justifyContent: 'center' },
  sliderTrack: { height: 14, borderRadius: 7, justifyContent: 'center', overflow: 'hidden' },
  sliderFill: { height: 14, borderRadius: 7 },
  stopDot: { position: 'absolute', top: 15, width: 6, height: 6, borderRadius: 3 },
  thumb: { position: 'absolute', top: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, elevation: 3 },
  bubble: { position: 'absolute', top: -26, width: 44, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  bubbleText: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
  pad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 6, flex: 1 },
  padKey: { width: '33.333%', alignItems: 'center', justifyContent: 'center', height: 64 },
  padText: { fontSize: 28, fontFamily: 'Inter-600', fontWeight: '600' },
  slide: { height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  slideText: { fontSize: 17, fontFamily: 'Inter-600', fontWeight: '600' },
  knob: { position: 'absolute', left: 6, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  card: { marginHorizontal: 16, marginTop: 10, borderRadius: 20, paddingVertical: 6 },
  provRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  provName: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  provBal: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  netNote: { fontSize: 16, lineHeight: 24, fontFamily: 'Inter-500', fontWeight: '500', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
  netRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 74 },
  netIcon: { width: 54, height: 54, borderRadius: 10, overflow: 'hidden', marginRight: 16 },
  netName: { flex: 1, fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
});
