/**
 * Veltravia Wallet — Receive sheet.
 *
 * Mirrors Trust Wallet's Receive flow (screen recording, 2026-10-13):
 *
 *   Receive      : X (left) + centred title. Network pill, QR card with the
 *                  address under it, warning banner, Copy / Share tiles and
 *                  a "Deposit from Binance" bar.
 *   Skeleton     : shown the instant the sheet opens, until the address is
 *                  derived. Pill 149x39, QR card 342x394, address bar 376x70
 *                  (measured from Trust's loading screenshot).
 *   Network      : the pill swaps the sheet content to "Select network"
 *                  (back arrow), searchable list.
 *   Deposit      : "Deposit from Binance" (back arrow), search + skeleton list.
 *   Tap QR       : copies the address automatically and shows the top
 *                  "Address copied" toast (plus a light haptic).
 *   Share        : the Android share sheet with the QR IMAGE + address text
 *
 * The sheet is tall (top ~6% down, 40dp corners), animates up, and can be
 * dragged down to dismiss.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  PanResponder,
  Easing,
  Share,
  TextInput,
  FlatList,
  Image,
  useWindowDimensions,
} from 'react-native';
import Svg, { Rect as SvgRect, Path as SvgPath, Circle as SvgCircle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { SkeletonBlock } from './Skeleton';
import QrCode from './QrCode';
import CoinLogo from './CoinLogo';
import { CloseIcon, BackIcon, ChevronDownIcon, CopyIcon, ShareIcon, AlertCircleIcon, SearchIcon } from './icons';
import { copyToClipboard } from '../core/clipboard';
import { encodeQr } from '../core/qr';
import { getShareTargets, shareQrTo, shareQrImage, ShareTarget } from '../core/shareQr';
import { showToast } from './Toast';
import { RECEIVE_NETWORKS, ReceiveNetwork, getReceiveAddress } from '../core/receive';
import { coinColor } from '../core/coinColors';

type View_ = 'receive' | 'network' | 'binance' | 'share';

const TOP_GAP = 24; // dp from screen top to sheet top (Trust: ~6%)
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.9;

export default function ReceiveSheet({
  visible,
  onClose,
  walletId,
}: {
  visible: boolean;
  onClose: () => void;
  walletId: string;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  const dark = theme.mode === 'dark';

  const [view, setView] = useState<View_>('receive');
  const [network, setNetwork] = useState<ReceiveNetwork>(
    RECEIVE_NETWORKS.find((n) => n.id === '56') ?? RECEIVE_NETWORKS[0],
  );
  const [address, setAddress] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const sheetH = winH - TOP_GAP;
  const translateY = useRef(new Animated.Value(sheetH)).current;
  const backdrop = translateY.interpolate({ inputRange: [0, sheetH], outputRange: [1, 0], extrapolate: 'clamp' });

  // Open: reset to the Receive view, show the skeleton, derive the address.
  useEffect(() => {
    if (!visible) return;
    setView('receive');
    setQuery('');
    setAddress(null);
    translateY.setValue(sheetH);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, sheetH, translateY]);

  // Derive whenever the sheet is open and the network changes.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setAddress(null);
    getReceiveAddress(walletId, network).then((a) => {
      if (!cancelled) setAddress(a);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, walletId, network]);

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: sheetH,
      duration: 230,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onClose());
  }, [onClose, sheetH, translateY]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
        onPanResponderMove: (_e, g) => translateY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) dismiss();
          else Animated.spring(translateY, { toValue: 0, bounciness: 0, speed: 20, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(translateY, { toValue: 0, bounciness: 0, speed: 20, useNativeDriver: true }).start(),
      }),
    [dismiss, translateY],
  );

  const sheetBg = dark ? theme.surface : '#FFFFFF';
  const tile = dark ? 'rgba(255,255,255,0.08)' : '#EFEFF3';
  const circleBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(60,64,90,0.08)';

  const onCopy = () => {
    if (!address) return;
    const ok = copyToClipboard(address);
    showToast(ok ? 'Address copied' : "Couldn't copy the address", { kind: ok ? 'success' : 'error' });
  };

  const shareText = address ? `My ${network.name} address to receive ${network.symbol}:\n${address}` : '';

  const openChooser = async () => {
    if (!address) return;
    const text = shareText;
    // Android: the share sheet gets the QR as a PNG plus the address text.
    // iOS / module missing: falls back to plain text (image share needs the
    // native module; add it in the iOS phase).
    const shared = shareQrImage(encodeQr(address), text, network.symbol);
    if (!shared) {
      try {
        await Share.share({ message: text });
      } catch {
        /* dismissed */
      }
    }
  };

  const goBack = () => {
    setQuery('');
    setView('receive');
  };

  const headerTitle =
    view === 'receive' ? 'Receive' : view === 'network' ? 'Select network' : view === 'share' ? 'Share Via' : 'Deposit from Binance';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.flex}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.sheet,
            { height: sheetH, backgroundColor: sheetBg, transform: [{ translateY }] },
          ]}
        >
          {/* ---------- Header: X / back + centred title ---------- */}
          <View style={styles.header}>
            {view === 'share' ? null : (
              <Pressable
                hitSlop={10}
                onPress={view === 'receive' ? dismiss : goBack}
                style={[styles.circle, { backgroundColor: circleBg }]}
              >
                {view === 'receive' ? (
                  <CloseIcon size={18} color={theme.ink} />
                ) : (
                  <BackIcon size={20} color={theme.ink} />
                )}
              </Pressable>
            )}
            {view === 'share' ? (
              <Pressable hitSlop={12} onPress={goBack} style={styles.shareClose}>
                <CloseIcon size={22} color={theme.inkMuted} />
              </Pressable>
            ) : null}
            <View style={styles.titleWrap} pointerEvents="none">
              <Text style={[styles.title, { color: theme.ink }]}>{headerTitle}</Text>
            </View>
          </View>

          {view === 'receive' && (
            <ReceiveBody
              address={address}
              network={network}
              winW={winW}
              bottomInset={insets.bottom}
              tile={tile}
              onPickNetwork={() => setView('network')}
              onCopy={onCopy}
              onShare={() => setView('share')}
              onBinance={() => setView('binance')}
            />
          )}

          {view === 'network' && (
            <NetworkList
              query={query}
              setQuery={setQuery}
              selectedId={network.id}
              tile={tile}
              bottomInset={insets.bottom}
              onSelect={(n) => {
                setNetwork(n);
                setQuery('');
                setView('receive');
              }}
            />
          )}

          {view === 'share' && address ? (
            <ShareVia
              address={address}
              network={network}
              winW={winW}
              bottomInset={insets.bottom}
              tile={tile}
              onCopy={onCopy}
              onShareImage={openChooser}
            />
          ) : null}

          {view === 'binance' && <BinanceDeposit query={query} setQuery={setQuery} tile={tile} />}
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Receive body: skeleton while loading, QR + actions once derived     */
/* ------------------------------------------------------------------ */

function ReceiveBody({
  address,
  network,
  winW,
  bottomInset,
  tile,
  onPickNetwork,
  onCopy,
  onShare,
  onBinance,
}: {
  address: string | null;
  network: ReceiveNetwork;
  winW: number;
  bottomInset: number;
  tile: string;
  onPickNetwork: () => void;
  onCopy: () => void;
  onShare: () => void;
  onBinance: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const cardW = Math.min(winW - 32, 360);
  const qrSize = cardW - 32;

  if (!address) {
    // Trust's loading layout, measured: pill 149x39, card 342x394, bar 376x70.
    return (
      <View style={styles.body}>
        <SkeletonBlock style={{ width: 149, height: 39, borderRadius: 20, marginTop: 8 }} />
        <SkeletonBlock style={{ width: winW - 68, height: 394, borderRadius: 24, marginTop: 8 }} />
        <View style={styles.flex} />
        <SkeletonBlock
          style={{ width: winW - 32, height: 70, borderRadius: 24, marginBottom: Math.max(bottomInset, 12) + 8 }}
        />
      </View>
    );
  }

  // Split the address over two lines like Trust (first 40 chars then the rest).
  const line1 = address.slice(0, 40);
  const line2 = address.slice(40);

  return (
    <View style={styles.body}>
      {/* Network pill */}
      <Pressable onPress={onPickNetwork} style={[styles.netPill, { backgroundColor: tile }]}>
        <View style={styles.netLogo}>
          <CoinLogo symbol={network.symbol} size={22} />
        </View>
        <Text style={[styles.netText, { color: theme.ink }]}>{network.name}</Text>
        <ChevronDownIcon size={16} color={theme.ink} />
      </Pressable>

      {/* QR card: tapping it copies the address automatically.
          The 16dp padding IS the QR quiet zone. Tested: 100% decode at 16dp,
          94% at ~10dp, 0% with none. Do not reduce it. */}
      <Pressable
        onPress={onCopy}
        style={[
          styles.qrCard,
          { width: cardW, backgroundColor: '#FFFFFF', borderColor: dark ? 'transparent' : 'rgba(20,21,43,0.06)' },
        ]}
      >
        <QrCode
          value={address}
          size={qrSize}
          logo={
            <>
              <SvgRect x="0" y="0" width="100" height="100" rx="22" fill="#14152B" />
              <SvgPath d="M26 34l24 34 24-34" stroke="#FFFFFF" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          }
        />
        <Text style={styles.addr}>
          {line1}
          {'\n'}
          {line2}
        </Text>
      </Pressable>

      {/* Warning */}
      <View style={[styles.warn, { backgroundColor: dark ? 'rgba(245,166,35,0.14)' : '#F7EDE3' }]}>
        <AlertCircleIcon size={18} color="#E08A12" />
        <Text style={[styles.warnText, { color: theme.ink }]}>
          Only send {network.name} assets to this address. Other assets will be lost forever.
        </Text>
      </View>

      {/* Copy / Share */}
      <View style={styles.actions}>
        <Pressable onPress={onCopy} style={styles.actionCol}>
          <View style={[styles.actionTile, { backgroundColor: tile }]}>
            <CopyIcon size={22} color={theme.ink} />
          </View>
          <Text style={[styles.actionLabel, { color: theme.ink }]}>Copy</Text>
        </Pressable>
        <Pressable onPress={onShare} style={styles.actionCol}>
          <View style={[styles.actionTile, { backgroundColor: tile }]}>
            <ShareIcon size={22} color={theme.ink} />
          </View>
          <Text style={[styles.actionLabel, { color: theme.ink }]}>Share</Text>
        </Pressable>
      </View>

      <View style={styles.flex} />

      {/* Deposit from Binance */}
      <Pressable
        onPress={onBinance}
        style={[styles.binance, { backgroundColor: tile, marginBottom: Math.max(bottomInset, 12) + 8 }]}
      >
        <View style={styles.binanceLogo}>
          <Svg width={22} height={22} viewBox="0 0 32 32">
            <SvgRect width="32" height="32" rx="16" fill="#F3BA2F" />
            <SvgPath
              fill="#14152B"
              d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.003-.003 2.263-2.257zM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16zm-3.188-.002h.002V16L16 18.294l-2.291-2.29-.004-.004.004-.003.401-.402.195-.195L16 13.706l2.293 2.293z"
            />
          </Svg>
        </View>
        <Text style={[styles.binanceText, { color: theme.ink }]}>Deposit from Binance</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Share Via: Trust's in-app share sheet. Measured from their screenshot: */
/* QR 201dp centred on plain white (no card), divider, address row with    */
/* copy icon, divider, then the share targets.                             */
/* ------------------------------------------------------------------ */

function ShareVia({
  address,
  network,
  winW,
  bottomInset,
  tile,
  onCopy,
  onShareImage,
}: {
  address: string;
  network: ReceiveNetwork;
  winW: number;
  bottomInset: number;
  tile: string;
  onCopy: () => void;
  onShareImage: () => void;
}) {
  const { theme } = useTheme();
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const rowsRef = useRef<FlatList<ShareTarget> | null>(null);
  useEffect(() => {
    let alive = true;
    getShareTargets().then((t) => alive && setTargets(t));
    return () => {
      alive = false;
    };
  }, []);
  const divider = theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : '#E8E8EC';
  const qrSize = Math.min(202, winW - 64);
  const short = address.length > 24 ? `${address.slice(0, 22)}...` : address;

  return (
    <View style={styles.flex}>
      <View style={[styles.shareQrWrap, { borderBottomColor: divider }]}>
        <QrCode
          value={address}
          size={qrSize}
          logo={
            <>
              <SvgRect x="-6" y="-6" width="112" height="112" rx="26" fill="#FFFFFF" />
              <SvgCircle cx="50" cy="50" r="50" fill={coinColor(network.symbol)} />
            </>
          }
        />
      </View>

      <Pressable onPress={onCopy} style={[styles.shareAddrRow, { borderBottomColor: divider }]}>
        <View style={styles.flex}>
          <Text style={[styles.shareAddrTitle, { color: theme.ink }]}>
            My {network.name} address to receive:
          </Text>
          <Text style={[styles.shareAddrValue, { color: theme.ink }]} numberOfLines={1}>
            {short}
          </Text>
        </View>
        <CopyIcon size={22} color={theme.inkMuted} />
      </Pressable>

      {/* Share targets: Trust lists the apps inside the sheet (4 columns,
          48dp icons, labels beneath, tapping shares DIRECTLY to that app).
          The system chooser stays available as "More". */}
      <FlatList
        ref={rowsRef}
        style={styles.flex}
        data={targets}
        keyExtractor={(t) => t.packageName + t.className}
        numColumns={4}
        contentContainerStyle={[styles.shareGrid, { paddingBottom: Math.max(bottomInset, 12) + 8 }]}
        renderItem={({ item }) => (
          <Pressable
            style={styles.shareApp}
            onPress={() => {
              const text = `My ${network.name} address to receive ${network.symbol}:\n${address}`;
              if (!shareQrTo(item, encodeQr(address), text, network.symbol)) {
                onShareImage();
              }
            }}
          >
            <Image
              source={{ uri: `data:image/png;base64,${item.icon}` }}
              style={styles.shareAppIcon}
            />
            <Text style={[styles.shareAppLabel, { color: theme.ink }]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable style={styles.shareApp} onPress={onShareImage}>
            <View style={[styles.shareMoreIcon, { backgroundColor: tile }]}>
              <ShareIcon size={22} color={theme.ink} />
            </View>
            <Text style={[styles.shareAppLabel, { color: theme.ink }]} numberOfLines={1}>
              More
            </Text>
          </Pressable>
        }
      />

    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Select network                                                      */
/* ------------------------------------------------------------------ */

function NetworkList({
  query,
  setQuery,
  selectedId,
  tile,
  bottomInset,
  onSelect,
}: {
  query: string;
  setQuery: (q: string) => void;
  selectedId: string;
  tile: string;
  bottomInset: number;
  onSelect: (n: ReceiveNetwork) => void;
}) {
  const { theme } = useTheme();
  const list = RECEIVE_NETWORKS.filter((n) => n.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <View style={styles.flex}>
      <SearchField value={query} onChange={setQuery} placeholder="All networks" tile={tile} />
      <FlatList
        data={list}
        keyExtractor={(n) => n.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => onSelect(item)} style={styles.netRow}>
            <View style={styles.netRowLogo}>
              <CoinLogo symbol={item.symbol} size={40} />
            </View>
            <Text style={[styles.netRowText, { color: theme.ink }]}>{item.name}</Text>
            {item.id === selectedId ? <View style={[styles.selDot, { backgroundColor: theme.brandGradient[0] }]} /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.inkMuted }]}>No networks match "{query}"</Text>
        }
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Deposit from Binance (search + skeleton list; real data needs the    */
/* Binance link which is a later phase)                                 */
/* ------------------------------------------------------------------ */

function BinanceDeposit({
  query,
  setQuery,
  tile,
}: {
  query: string;
  setQuery: (q: string) => void;
  tile: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.flex}>
      <SearchField value={query} onChange={setQuery} placeholder="Search" tile={tile} />
      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={styles.skelRow}>
            <SkeletonBlock style={{ width: 48, height: 48, borderRadius: 24 }} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <SkeletonBlock style={{ width: 160, height: 16, borderRadius: 4 }} />
              <SkeletonBlock style={{ width: 106, height: 12, borderRadius: 4, marginTop: 8 }} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <SkeletonBlock style={{ width: 80, height: 16, borderRadius: 4 }} />
              <SkeletonBlock style={{ width: 52, height: 12, borderRadius: 4, marginTop: 8 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
  tile,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  tile: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: tile }]}>
      <SearchIcon size={20} color={theme.inkMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.inkMuted}
        style={[styles.searchInput, { color: theme.ink }]}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,16,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden' },

  shareClose: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center', zIndex: 2 },
  shareQrWrap: { alignItems: 'center', paddingTop: 12, paddingBottom: 26, borderBottomWidth: StyleSheet.hairlineWidth },
  shareAddrRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 24, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  shareAddrTitle: { fontSize: 15, lineHeight: 21, fontFamily: 'Inter-700', fontWeight: '700' },
  shareAddrValue: { fontSize: 15, lineHeight: 21, fontFamily: 'Inter-700', fontWeight: '700', marginTop: 1 },
  shareGrid: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  shareApp: { width: '25%', alignItems: 'center', marginBottom: 20 },
  shareAppIcon: { width: 48, height: 48, borderRadius: 14 },
  shareMoreIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  shareAppLabel: { fontSize: 11.5, lineHeight: 14, marginTop: 8, fontFamily: 'Inter-600', fontWeight: '600' },
  headerTitleCentered: { textAlign: 'center', flex: 1 },
  header: { height: 64, justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  titleWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },

  body: { flex: 1, alignItems: 'center', paddingHorizontal: 16, paddingTop: 4 },

  netPill: { height: 39, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  netLogo: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden' },
  netText: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700' },

  qrCard: {
    marginTop: 10,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  addr: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#14152B',
    fontFamily: 'Inter-700',
    fontWeight: '700',
  },

  warn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, marginTop: 16, width: '100%' },
  warnText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: 'Inter-500', fontWeight: '500' },

  actions: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  actionCol: { flex: 1, alignItems: 'center' },
  actionTile: { width: '100%', height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { marginTop: 8, fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600' },

  binance: { width: '100%', height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  binanceLogo: { width: 22, height: 22 },
  binanceText: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },

  search: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginHorizontal: 16, marginTop: 4, gap: 10 },
  searchInput: { flex: 1, fontSize: 16, fontFamily: 'Inter-500', fontWeight: '500', padding: 0 },

  netRow: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: 20 },
  netRowLogo: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginRight: 16 },
  netRowText: { flex: 1, fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  selDot: { width: 10, height: 10, borderRadius: 5 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },

  skelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
});
