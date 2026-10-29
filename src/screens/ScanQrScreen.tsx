/**
 * Veltravia Wallet — Scan QR code (Trust parity).
 *
 * Full-screen camera scanner shown as a modal route. Dark camera feed with a
 * dimmed mask around a clear center window, four thick rounded white corner
 * brackets, header with translucent circular buttons (close X, gallery,
 * flashlight toggle) and centered white "Scan QR code", plus the white home
 * gesture bar at the bottom.
 *
 * A detected code is handed to the registered scan target (see
 * services/scanTarget) and the screen pops. Gallery decodes a QR from a
 * picked photo locally (jpeg-js + jsQR) — no upload, no third party.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseIcon, GalleryIcon, FlashIcon } from '../components/icons';
import { deliverScanResult, clearScanTarget } from '../services/scanTarget';
import { codeTargetRect, morphDuration, type Rect } from '../services/scanFrame';
import { showToast } from '../components/Toast';

// Every value below is measured off Trust's scanner screenshot (461px wide =
// 411dp, so 1dp = 1.1216px) — see the README note.
const FRAME = 277;      // outer side of the bracket square
const ARM = 55;         // length of each bracket arm
const THICK = 10;       // bracket line thickness
const RADIUS = 18;      // outer corner radius of each bracket
const BTN = 47;         // header button diameter
const EDGE = 18;        // header side margin
const GAP = 9;          // gap between the gallery and torch buttons

export default function ScanQrScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back', { physicalDevices: ['wide-angle-camera'] });
  const [torch, setTorch] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const done = useRef(false);

  // A result only counts once; the screen pops on the first valid code.
  const deliver = useCallback((value: string) => {
    if (done.current) return;
    done.current = true;
    if (deliverScanResult(value)) navigation.goBack();
    else showToast('Scanned: ' + value, { kind: 'info' });
  }, [navigation]);

  // -- the brackets, which start centred and fly onto the code before it is read
  const winX = (width - FRAME) / 2;
  const winY = (height - FRAME) / 2;
  const boxLeft = useRef(new Animated.Value(winX)).current;
  const boxTop = useRef(new Animated.Value(winY)).current;
  const boxSize = useRef(new Animated.Value(FRAME)).current;
  const box = useRef<Rect>({ left: winX, top: winY, width: FRAME, height: FRAME });
  const chasing = useRef(false);   // locked onto a code: ignore anything else

  // Fly the brackets onto the code, then read it once they have settled there.
  const snapTo = useCallback((rect: Rect, value: string) => {
    chasing.current = true;
    const duration = morphDuration(box.current, rect);
    Animated.parallel([
      Animated.timing(boxLeft, { toValue: rect.left, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(boxTop, { toValue: rect.top, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(boxSize, { toValue: rect.width, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (!finished) return;
      box.current = rect;
      // a short hold so the user sees the frame sitting on the code, then report it
      setTimeout(() => deliver(value), 130);
    });
  }, [boxLeft, boxTop, boxSize, deliver]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (done.current || chasing.current) return;
      const hit = codes.find((c) => !!c?.value && !!c.value.trim());
      if (!hit?.value) return;
      const rect = codeTargetRect(hit, { width, height });
      if (!rect) { deliver(hit.value.trim()); return; }   // no geometry: read it straight away
      snapTo(rect, hit.value.trim());
    },
  });

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
      if (code?.data) deliver(code.data);
      else showToast('No QR code found in that image', { kind: 'error' });
    } catch {
      showToast("Couldn't read that image", { kind: 'error' });
    } finally {
      setDecoding(false);
    }
  }, [deliver]);

  const maskBg = { backgroundColor: 'rgba(0,0,0,0.66)' };

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

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        torch={torch ? 'on' : 'off'}
        codeScanner={codeScanner}
      />

      {/* dimmed mask: its clear window is the same animated box as the brackets, so the
          window glides onto the code together with them */}
      <View style={styles.maskLayer} pointerEvents="none">
        <Animated.View style={[styles.mask, maskBg, { position: 'absolute', left: 0, right: 0, top: 0, height: boxTop }]} />
        <Animated.View style={[styles.mask, maskBg, { position: 'absolute', left: 0, right: 0, top: Animated.add(boxTop, boxSize), bottom: 0 }]} />
        <Animated.View style={[styles.mask, maskBg, { position: 'absolute', top: boxTop, height: boxSize, left: 0, width: boxLeft }]} />
        <Animated.View style={[styles.mask, maskBg, { position: 'absolute', top: boxTop, height: boxSize, right: 0, left: Animated.add(boxLeft, boxSize) }]} />

        {/* corner brackets */}
        <Animated.View testID="scanBox" style={{ position: 'absolute', left: boxLeft, top: boxTop, width: boxSize, height: boxSize }}>
          <View style={[styles.bracket, styles.tl, { borderTopLeftRadius: RADIUS }]} />
          <View style={[styles.bracket, styles.tr, { borderTopRightRadius: RADIUS }]} />
          <View style={[styles.bracket, styles.bl, { borderBottomLeftRadius: RADIUS }]} />
          <View style={[styles.bracket, styles.br, { borderBottomRightRadius: RADIUS }]} />
        </Animated.View>
      </View>

      {/* header: close on the left, gallery + torch on the right, title centred on the
          screen itself (not in the leftover space, which would push it left) */}
      <View style={[styles.header, { top: insets.top + 12 }]}>
        <Pressable style={styles.btn} onPress={close} hitSlop={10} accessibilityLabel="Close scanner">
          <CloseIcon size={15} color="#FFFFFF" strokeWidth={2.6} />
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable style={styles.btn} onPress={openGallery} disabled={decoding} hitSlop={10} accessibilityLabel="Pick a QR image">
            {decoding ? <ActivityIndicator size="small" color="#FFFFFF" /> : <GalleryIcon size={21} color="#FFFFFF" />}
          </Pressable>
          <Pressable style={styles.btn} onPress={() => setTorch((v) => !v)} hitSlop={10} accessibilityLabel="Torch">
            <FlashIcon size={21} color={torch ? '#FFD24A' : '#FFFFFF'} />
          </Pressable>
        </View>
        <Text style={[styles.title, { top: (BTN - 21) / 2 }]} pointerEvents="none">Scan QR code</Text>
      </View>

      {/* home gesture bar */}
      <View style={styles.gesture} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  maskLayer: StyleSheet.absoluteFill as object,
  mask: { backgroundColor: 'rgba(0,0,0,0.66)' },
  header: { position: 'absolute', left: EDGE, right: EDGE, height: BTN, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  btn: { width: BTN, height: BTN, borderRadius: BTN / 2, backgroundColor: '#202020', alignItems: 'center', justifyContent: 'center' },
  title: { position: 'absolute', left: -EDGE, right: -EDGE, textAlign: 'center', color: '#FFFFFF', fontSize: 17, fontFamily: 'Inter-500', fontWeight: '500', letterSpacing: 0.1 },
  bracket: { position: 'absolute', width: ARM, height: ARM, borderColor: '#FFFFFF', borderWidth: THICK },
  tl: { left: 0, top: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { right: 0, top: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { left: 0, bottom: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { right: 0, bottom: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  gesture: { position: 'absolute', bottom: 10, alignSelf: 'center', width: 140, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF', opacity: 0.9 },
  permTitle: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  permBody: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Inter-400', marginTop: 8, textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 },
  permBtn: { height: 46, borderRadius: 23, paddingHorizontal: 22, backgroundColor: '#333333', alignItems: 'center', justifyContent: 'center' },
  permBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  permSkip: { marginTop: 18, padding: 8 },
  permSkipText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontFamily: 'Inter-500' },
});
