/**
 * Veltravia Wallet — "Link device" scanner.
 *
 * Rebuilt to the reference screen: deep navy ground with a soft brand shape in
 * the top corner, a back chevron, the "Scan QR Code" headline with the second
 * half in the blue-to-purple gradient, the pairing subtitle, a live camera
 * window with glowing gradient corners, the expiry pill under it, and the
 * instruction card with the full-width Cancel above the safe area.
 *
 * No logo, no app name.
 *
 * One scanner serves the app: a caller registers a purpose (services/scanTarget)
 * to change the title and to vet the code. With no purpose registered the screen
 * is the link-device scanner — pairing copy and a live 60s expiry pill, matching
 * the lifetime of a pairing code (core/security/pairingSession).
 *
 * The camera feed never leaves the device. Gallery images are decoded locally
 * (jpeg-js + jsQR).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions, StatusBar, Linking,
} from 'react-native';
import {
  Camera, useCameraDevice, useCodeScanner, useCameraPermission,
} from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import jpeg from 'jpeg-js';
import jsQR from 'jsqr';
import { useNavigation } from '@react-navigation/native';
import Svg, {
  Defs, LinearGradient as SvgGradient, Stop, Rect, Mask, Path, Text as SvgText,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeftIcon, GalleryIcon, FlashIcon, ClockIcon, PhoneIcon } from '../components/icons';
import GlowCorners, { GLOW_FROM, GLOW_TO } from '../components/GlowCorners';
import { hasScanTarget, offerScanResult, clearScanTarget, activeScanTitle, activeScanHint } from '../services/scanTarget';
import { parseQr, type ParsedQr } from '../services/qrParse';
import { parsePairingCode, PAIRING_TTL_MS } from '../core/security/pairingSession';
import ScanResultSheet from '../components/ScanResultSheet';
import { copyToClipboard } from '../core/clipboard';
import { captureFeedback, captureBell } from '../core/scanFeedback';
import { showToast } from '../components/Toast';

const NAVY = '#0B0E1A';
const PANEL = '#131A31';
const PILL = '#161C31';
const RADIUS = 28;      // scan window corner radius
const ARM = 46;         // length of each glowing corner arm
const EDGE = 18;

/** "Scan QR code" → ["Scan ", "QR code"], so the second half can take the gradient. */
function splitTitle(title: string): [string, string] {
  const m = /^(Scan )(.+)$/.exec(title);
  return m ? [m[1], m[2]] : ['', title];
}

export default function ScanQrScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back', { physicalDevices: ['wide-angle-camera'] });
  const [torch, setTorch] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [sheet, setSheet] = useState<ParsedQr | null>(null);
  const done = useRef(false);

  // Link-device mode: nothing else asked for the scanner, so this is the pairing
  // scanner and the code on the other device is the one that times out.
  const linkMode = !hasScanTarget() || !activeScanHint();
  const [expiryTick, setExpiryTick] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(PAIRING_TTL_MS / 1000));

  useEffect(() => {
    if (!linkMode) return;
    setSecondsLeft(Math.round(PAIRING_TTL_MS / 1000));
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [linkMode, expiryTick]);

  const windowSize = Math.min(width - 96, 268);
  const fx = (width - windowSize) / 2;
  const fy = Math.max(insets.top + 168, height * 0.34);

  // A result only counts once; the screen pops on the first valid code.
  const deliver = useCallback((value: string) => {
    if (done.current) return;
    done.current = true;
    captureFeedback();                 // bell + tick, exactly when the code is taken
    const parsed = parseQr(value);
    if (hasScanTarget()) {
      // The waiting screen decides whether this code is its business. A refusal
      // leaves the scanner open with the reason, instead of handing over junk.
      const outcome = offerScanResult(parsed.value);
      if (outcome.status === 'delivered') {
        navigation.goBack();
        return;
      }
      if (outcome.status === 'rejected') {
        done.current = false;
        showToast(outcome.reason, { kind: 'info', duration: 3000 });
        return;
      }
    }
    // Nobody was waiting (home scan button) or the code is actionless: keep the
    // sheet on screen instead of a toast so the reason stays visible.
    setSheet(parsed);
  }, [navigation]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (done.current) return;
      const hit = codes.find((c) => !!c?.value && !!c.value.trim());
      if (!hit?.value) return;
      deliver(hit.value.trim());
    },
  });

  const closeSheet = useCallback(() => setSheet(null), []);

  // The sheet's primary action depends on what was read: copy an address, open a
  // link, or start a WalletConnect pairing (not wired yet, so say so plainly).
  const sheetPrimary = useCallback(() => {
    if (!sheet) return;
    if (sheet.kind === 'url') {
      setSheet(null);
      Linking.openURL(sheet.value).catch(() => showToast("Couldn't open that link", { kind: 'error' }));
      return;
    }
    if (sheet.kind === 'pairing') {
      setSheet(null);
      const parsed = parsePairingCode(sheet.value);
      if (!parsed.ok) {
        showToast("That pairing code can't be used. Ask for a new one.", { kind: 'error', duration: 3200 });
        return;
      }
      navigation.navigate('PairVerify', { uri: sheet.value });
      return;
    }
    if (sheet.kind === 'walletconnect') {
      setSheet(null);
      showToast('WalletConnect pairing arrives with the dApp session work.', { kind: 'info', duration: 2600 });
      return;
    }
    const ok = copyToClipboard(sheet.value, { sensitive: true });
    setSheet(null);
    showToast(ok ? 'Address copied' : "Couldn't copy the address", { kind: ok ? 'success' : 'error' });
  }, [sheet, navigation]);

  const rescan = useCallback(() => { setSheet(null); done.current = false; }, []);

  const close = useCallback(() => {
    clearScanTarget();
    navigation.goBack();
  }, [navigation]);

  const openGallery = useCallback(async () => {
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9, maxWidth: 1600, maxHeight: 1600, includeBase64: true, selectionLimit: 1 });
      const b64 = res.assets?.[0]?.base64;
      if (!b64) return;
      setDecoding(true);
      // Decode locally only: the photo never leaves the device.
      const buf = (globalThis as any).Buffer;
      const img = jpeg.decode(buf.from(b64, 'base64'), { useTArray: true });
      const code = jsQR(new Uint8ClampedArray(img.data.buffer as ArrayBuffer, img.data.byteOffset, img.data.length), img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code?.data) { captureBell(); deliver(code.data); }
      else showToast('No QR code found in that image', { kind: 'error' });
    } catch {
      showToast("Couldn't read that image", { kind: 'error' });
    } finally {
      setDecoding(false);
    }
  }, [deliver]);

  if (!hasPermission) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>Veltravia scans QR codes locally. Nothing is ever uploaded.</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          <Pressable style={styles.permBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.permBtnText}>Settings</Text>
          </Pressable>
          <Pressable style={[styles.permBtn, { backgroundColor: '#6C63FF' }]} onPress={() => requestPermission()}>
            <Text style={styles.permBtnText}>Allow camera</Text>
          </Pressable>
        </View>
        <Pressable hitSlop={10} style={styles.permSkip} onPress={close}>
          <Text style={styles.permSkipText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  const [lead, gradientWord] = splitTitle(activeScanTitle('Scan QR Code'));
  const subtitle = activeScanHint() ?? 'Open your existing device and scan the QR code to pair.';
  const expired = secondsLeft <= 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* soft brand shape in the top corner, behind everything */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width={width} height={height}>
        <Defs>
          <SvgGradient id="blob" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GLOW_TO} stopOpacity="0.55" />
            <Stop offset="1" stopColor={GLOW_FROM} stopOpacity="0" />
          </SvgGradient>
        </Defs>
        <Path
          d={`M0,0 L ${width * 0.62},0 C ${width * 0.42},${height * 0.09} ${width * 0.2},${height * 0.16} 0,${height * 0.22} Z`}
          fill="url(#blob)"
          opacity={0.5}
        />
      </Svg>

      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        torch={torch ? 'on' : 'off'}
        codeScanner={codeScanner}
      />

      {/* everything except the rounded window is dimmed */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width={width} height={height}>
        <Defs>
          <Mask id="window">
            <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
            <Rect x={fx} y={fy} width={windowSize} height={windowSize} rx={RADIUS} fill="#000000" />
          </Mask>
          <SvgGradient id="corner" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GLOW_FROM} />
            <Stop offset="1" stopColor={GLOW_TO} />
          </SvgGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={NAVY} opacity={0.82} mask="url(#window)" />
        <Rect
          x={fx} y={fy} width={windowSize} height={windowSize} rx={RADIUS}
          fill="none" stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={1}
        />
        <GlowCorners x={fx} y={fy} size={windowSize} radius={RADIUS} arm={ARM} stroke="url(#corner)" />
      </Svg>

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconBtn} onPress={close} hitSlop={10} accessibilityLabel="Close scanner" testID="scanBack">
          <ChevronLeftIcon size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable style={styles.iconBtn} onPress={openGallery} disabled={decoding} hitSlop={10} accessibilityLabel="Pick a QR image">
            {decoding ? <ActivityIndicator size="small" color="#FFFFFF" /> : <GalleryIcon size={18} color="#FFFFFF" />}
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setTorch((v) => !v)} hitSlop={10} accessibilityLabel="Torch">
            <FlashIcon size={18} color={torch ? '#FFD24A' : '#FFFFFF'} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.headline, { top: insets.top + 64 }]} pointerEvents="none">
        <View style={styles.titleRow}>
          <Text style={styles.titleLead}>{lead}</Text>
          <Svg width={112} height={36}>
            <Defs>
              <SvgGradient id="headWord" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={GLOW_FROM} />
                <Stop offset="1" stopColor={GLOW_TO} />
              </SvgGradient>
            </Defs>
            <SvgText x={0} y={27} fontSize={27} fontFamily="Inter-700" fontWeight="700" fill="url(#headWord)">
              {gradientWord}
            </SvgText>
          </Svg>
        </View>
        <Text style={styles.subtitle} testID="scanSubtitle">{subtitle}</Text>
      </View>

      {/* expiry pill: the code on the other device is short-lived */}
      {linkMode ? (
        <Pressable
          onPress={() => { if (expired) setExpiryTick((t) => t + 1); }}
          disabled={!expired}
          style={[styles.pill, { top: fy + windowSize + 22 }]}
          testID="scanExpiry"
          accessibilityLabel={expired ? 'Code expired, tap to rescan' : `Expires in ${secondsLeft} seconds`}
        >
          <ClockIcon size={16} color="#FFFFFF" />
          <Text style={styles.pillText}>
            {expired ? 'Code expired · tap to rescan' : `Expires in ${secondsLeft}s`}
          </Text>
        </Pressable>
      ) : null}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.infoBox}>
          <View style={styles.infoIcon}>
            <PhoneIcon size={20} color="#7FC4FF" />
          </View>
          <Text style={styles.infoText}>Make sure the QR code is clearly visible and within the frame.</Text>
        </View>
        <Pressable style={styles.cancel} onPress={close} testID="scanCancel" accessibilityLabel="Cancel">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>

      <ScanResultSheet
        visible={sheet !== null}
        parsed={sheet}
        onClose={closeSheet}
        onRescan={rescan}
        onPrimary={sheetPrimary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { position: 'absolute', left: EDGE, right: EDGE, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headline: { position: 'absolute', left: EDGE, right: EDGE, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  titleLead: {
    fontSize: 27, lineHeight: 36, color: '#FFFFFF',
    fontFamily: 'Inter-700', fontWeight: '700', letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 8, paddingHorizontal: 24, textAlign: 'center',
    fontSize: 14, lineHeight: 20, color: '#A0A3B1', fontFamily: 'Inter-400',
  },
  pill: {
    position: 'absolute', alignSelf: 'center',
    height: 38, borderRadius: 19, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PILL, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  pillText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter-500' },
  footer: { position: 'absolute', left: 16, right: 16, bottom: 0 },
  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: PANEL, borderRadius: 16, padding: 14, marginBottom: 12,
  },
  infoIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(46,162,248,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoText: { flex: 1, color: '#C9CCD6', fontSize: 13, lineHeight: 18, fontFamily: 'Inter-400' },
  cancel: { height: 52, borderRadius: 26, backgroundColor: PANEL, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  permTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  permBody: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Inter-400', marginTop: 8, textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 },
  permBtn: { height: 46, borderRadius: 23, paddingHorizontal: 22, backgroundColor: '#333333', alignItems: 'center', justifyContent: 'center' },
  permBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  permSkip: { marginTop: 18, padding: 8 },
  permSkipText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontFamily: 'Inter-500' },
});
