/**
 * Veltravia Wallet - QR scanner.
 *
 * Built to the reference shot (measured, not estimated): the camera fills the
 * screen, controls float on it in translucent dark, the title is centred bold
 * white, and the code is framed by four separate white corner brackets with no
 * border and no box inside.
 *
 * Measured off the reference (471px wide shot → x0.873 to dp):
 *   frame 317px = 67% of width, arms 62px = 54dp, stroke 12px = 10dp
 *   corner icon centres 46 / 359 / 423px = 40 / 314 / 370dp, title cap 16px
 *
 * One scanner serves the app: a caller registers a purpose (services/scanTarget)
 * to name the screen and to vet the code. With nobody waiting, a scan opens the
 * result sheet (ScanResultSheet) so the code is never just discarded.
 *
 * The camera feed never leaves the device. Gallery images are decoded locally
 * (jpeg-js + jsQR).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions, StatusBar, Linking, Animated, Easing,
} from 'react-native';
import {
  Camera, useCameraDevice, useCodeScanner, useCameraPermission,
} from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import jpeg from 'jpeg-js';
import jsQR from 'jsqr';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon, GalleryIcon, FlashIcon } from '../components/icons';
import { hasScanTarget, offerScanResult, clearScanTarget, activeScanTitle } from '../services/scanTarget';
import { parseQr, type ParsedQr } from '../services/qrParse';
import { parsePairingCode } from '../core/security/pairingSession';
import ScanResultSheet from '../components/ScanResultSheet';
import { copyToClipboard } from '../core/clipboard';
import { captureFeedback, captureBell } from '../core/scanFeedback';
import { showToast } from '../components/Toast';
import { scanWindow, isInsideWindow } from '../core/scan/window';

const WHITE = '#FFFFFF';
const VEIL = 'rgba(0,0,0,0.42)';   // the translucent buttons and their ground
const BEAM_MS = 2400;

/** Four corner brackets: two rounded strokes per corner, nothing in between. */
function CornerBrackets({ size, stroke, arm }: { size: number; stroke: number; arm: number }) {
  const i = stroke / 2;              // the stroke straddles the path: inset it
  const s = size - stroke;
  const r = Math.max(stroke / 2, 6);
  const a = Math.max(arm - stroke / 2, r + 4);
  const corners: [number, number, number, number, number, number][] = [
    // x, y, then the two directions the arms point
    [i, i, 1, 1, -1, -1],
    [i + s, i, -1, 1, 1, -1],
    [i + s, i + s, -1, -1, 1, 1],
    [i, i + s, 1, -1, -1, 1],
  ];
  return (
    <Svg width={size} height={size} pointerEvents="none">
      {corners.map(([x, y, sx, sy, qx, qy], idx) => {
        const d = `M ${x + sx * (r + a)} ${y} L ${x + sx * r} ${y} Q ${x} ${y} ${x} ${y + sy * r} L ${x} ${y + sy * (r + a)}`;
        return (
          <Path
            key={idx}
            d={d}
            stroke={WHITE}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            testID={`scanCorner${idx}`}
          />
        );
      })}
    </Svg>
  );
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
  const [opening, setOpening] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const done = useRef(false);

  // Size and place the window from the reference, never from a fixed number, so
  // small phones and tablets both keep the same proportion.
  const win = scanWindow(width, height);
  const frameSize = win.size;
  const frameX = win.x;
  const frameY = win.y;

  // A code counts once it is inside the window, not merely in view.
  const inWindow = useCallback(
    (frame?: { x: number; y: number; width: number; height: number }) => isInsideWindow(frame, win),
    [win],
  );

  useEffect(() => {
    const t = setTimeout(() => setOpening(false), 700);
    return () => clearTimeout(t);
  }, []);

  // The beam: one thin line sweeping the window, looped, cheap to run.
  const beam = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const travel = Animated.loop(Animated.sequence([
      Animated.timing(beam, { toValue: 1, duration: BEAM_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(beam, { toValue: 0, duration: BEAM_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    travel.start();
    return () => travel.stop();
  }, [beam]);

  // Detection response: the brackets take a quick breath. Nothing blocks the view.
  const pulse = useRef(new Animated.Value(0)).current;
  const thump = useCallback(() => {
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [pulse]);

  const deliver = useCallback((value: string) => {
    if (done.current) return;
    done.current = true;
    thump();
    setTimeout(() => { captureFeedback(); }, 90);   // bell as the brackets answer
    const parsed = parseQr(value);
    if (hasScanTarget()) {
      // The waiting screen decides whether this code is its business. A refusal
      // keeps the scanner open with the reason, instead of handing over junk.
      const outcome = offerScanResult(parsed.value);
      if (outcome.status === 'delivered') { navigation.goBack(); return; }
      if (outcome.status === 'rejected') {
        done.current = false;
        showToast(outcome.reason, { kind: 'info', duration: 3000 });
        return;
      }
    }
    // Nobody waiting, or the code needs a decision: keep it on screen in the sheet.
    setSheet(parsed);
  }, [navigation, thump]);

  // Cameras report code geometry in different spaces (screen, preview, or not at
  // all). The window decides what counts, but a code that keeps coming back
  // outside it is still taken after a moment: a wrong coordinate space must not
  // leave someone with a scanner that never reads anything.
  const misses = useRef<Map<string, number>>(new Map());
  const OUTSIDE_LIMIT = 6;

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (done.current) return;
      const live = codes.filter((c) => !!c?.value?.trim());
      if (!live.length) return;
      const framed = live.find((c) => inWindow(c.frame as any));
      if (framed?.value) { deliver(framed.value.trim()); return; }
      for (const c of live) {
        const v = String(c.value).trim();
        const seen = (misses.current.get(v) ?? 0) + 1;
        misses.current.set(v, seen);
        if (seen >= OUTSIDE_LIMIT) { deliver(v); return; }
      }
    },
  });

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
      const code = jsQR(
        new Uint8ClampedArray(img.data.buffer as ArrayBuffer, img.data.byteOffset, img.data.length),
        img.width, img.height, { inversionAttempts: 'attemptBoth' },
      );
      if (code?.data) { captureBell(); deliver(code.data); }
      else showToast('No QR code found in that image', { kind: 'error' });
    } catch {
      showToast("Couldn't read that image", { kind: 'error' });
    } finally {
      setDecoding(false);
    }
  }, [deliver]);

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

  // ---- permission and camera states -------------------------------------------------

  if (hasPermission === false) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.stateIcon}><CloseIcon size={22} color={WHITE} /></View>
        <Text style={styles.stateTitle}>Camera access is off</Text>
        <Text style={styles.stateBody}>
          Veltravia reads QR codes on this device only. Nothing is uploaded, and nothing is scanned until you allow it.
        </Text>
        <Pressable style={styles.statePrimary} onPress={() => requestPermission()} accessibilityLabel="Allow camera">
          <Text style={styles.statePrimaryText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openSettings()} hitSlop={10} accessibilityLabel="Open settings">
          <Text style={styles.stateLink}>Open settings</Text>
        </Pressable>
        <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close scanner">
          <Text style={styles.stateLink}>Close</Text>
        </Pressable>
      </View>
    );
  }

  if (cameraError) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.stateTitle}>Camera unavailable</Text>
        <Text style={styles.stateBody}>{cameraError}</Text>
        <Pressable style={styles.statePrimary} onPress={() => setCameraError(null)} accessibilityLabel="Try again">
          <Text style={styles.statePrimaryText}>Try again</Text>
        </Pressable>
        <Pressable onPress={openGallery} hitSlop={10} accessibilityLabel="Pick a QR image">
          <Text style={styles.stateLink}>Pick an image instead</Text>
        </Pressable>
        <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close scanner">
          <Text style={styles.stateLink}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const title = activeScanTitle('Scan QR code');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {device ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          torch={torch ? 'on' : 'off'}
          codeScanner={codeScanner}
          onError={(e) => setCameraError(e?.message ? `Veltravia could not start the camera. ${e.message}` : 'Veltravia could not start the camera.')}
        />
      ) : null}

      {(opening || !device) ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <ActivityIndicator color={WHITE} />
          <Text style={styles.opening}>Starting camera…</Text>
        </View>
      ) : null}

      {/* top bar: floats on the feed, nothing behind it but the buttons */}
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.roundBtn} onPress={close} hitSlop={10} accessibilityLabel="Close scanner" testID="scanClose">
          <CloseIcon size={17} color={WHITE} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1} testID="scanTitle">{title}</Text>
        <View style={styles.barRight}>
          <Pressable
            style={[styles.squareBtn, decoding ? { opacity: 0.6 } : null]}
            onPress={openGallery}
            disabled={decoding}
            hitSlop={8}
            accessibilityLabel="Pick a QR image"
            testID="scanGallery"
          >
            {decoding ? <ActivityIndicator size="small" color={WHITE} /> : <GalleryIcon size={20} color={WHITE} />}
          </Pressable>
          <Pressable
            style={[styles.squareBtn, torch ? styles.squareBtnOn : null]}
            onPress={() => setTorch((v) => !v)}
            hitSlop={8}
            accessibilityLabel={torch ? 'Turn the flashlight off' : 'Turn the flashlight on'}
            accessibilityState={{ selected: torch }}
            testID="scanTorch"
          >
            <FlashIcon size={20} color={torch ? '#FFD24A' : WHITE} />
          </Pressable>
        </View>
      </View>

      {/* the window: brackets only, the feed stays visible through it */}
      <Animated.View
        style={[
          styles.window,
          {
            left: frameX, top: frameY, width: frameSize, height: frameSize,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
          },
        ]}
        pointerEvents="none"
        testID="scanWindow"
      >
        <CornerBrackets size={frameSize} stroke={10} arm={54} />
        <Animated.View
          style={[
            styles.beam,
            { transform: [{ translateY: beam.interpolate({ inputRange: [0, 1], outputRange: [10, frameSize - 12] }) }] },
          ]}
        >
          <View style={styles.beamGlow} />
          <View style={styles.beamCore} />
        </Animated.View>
      </Animated.View>

      <ScanResultSheet
        visible={sheet !== null}
        parsed={sheet}
        onClose={() => setSheet(null)}
        onRescan={rescan}
        onPrimary={sheetPrimary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center' },

  bar: {
    position: 'absolute', left: 0, right: 0, top: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  roundBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: VEIL, alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1, textAlign: 'center', color: WHITE,
    fontSize: 20, fontFamily: 'Inter-700', fontWeight: '700',
    marginHorizontal: 8,
  },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  squareBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: VEIL, alignItems: 'center', justifyContent: 'center',
  },
  squareBtnOn: { backgroundColor: 'rgba(255,210,74,0.22)' },

  window: { position: 'absolute' },
  beam: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  beamGlow: {
    position: 'absolute', top: 4, height: 14, left: 0, right: 0,
    backgroundColor: 'rgba(108,99,255,0.22)', borderRadius: 8,
  },
  beamCore: { height: 1.5, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 1 },

  opening: { marginTop: 10, color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'Inter-400' },

  stateIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  stateTitle: { color: WHITE, fontSize: 19, fontFamily: 'Inter-700', fontWeight: '700', textAlign: 'center' },
  stateBody: {
    color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 20, textAlign: 'center',
    paddingHorizontal: 36, marginTop: 10, fontFamily: 'Inter-400',
  },
  statePrimary: {
    marginTop: 22, height: 48, paddingHorizontal: 30, borderRadius: 24,
    backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center',
  },
  statePrimaryText: { color: WHITE, fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  stateLink: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'Inter-500', marginTop: 16 },
});
