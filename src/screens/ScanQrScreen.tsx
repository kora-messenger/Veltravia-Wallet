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
  View, Text, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions, StatusBar, Linking,
} from 'react-native';
import {
  Camera, useCameraDevice, useCodeScanner, useCameraPermission,
} from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import jpeg from 'jpeg-js';
import jsQR from 'jsqr';
import { useNavigation } from '@react-navigation/native';
import { CloseIcon, GalleryIcon, FlashIcon } from '../components/icons';
import { deliverScanResult, clearScanTarget } from '../services/scanTarget';
import { showToast } from '../components/Toast';

const FRAME = 250;      // side of the clear scan window
const BRACKET = 9;      // thickness of the corner brackets
const BTN = 44;         // header button size

export default function ScanQrScreen() {
  const navigation = useNavigation<any>();
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

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      const v = codes[0]?.value;
      if (v && v.trim()) deliver(v.trim());
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

  // Left/top/right/bottom masks leave a clear window exactly at the center.
  const winX = (width - FRAME) / 2;
  const winY = (height - FRAME) / 2;
  const mask = (extra: object) => [styles.mask, { backgroundColor: 'rgba(10,10,14,0.62)' }, extra];

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

      {/* dimmed mask with a clear center window */}
      <View style={styles.maskLayer} pointerEvents="none">
        <View style={mask({ position: 'absolute', left: 0, right: 0, top: 0, height: winY })} />
        <View style={mask({ position: 'absolute', left: 0, right: 0, top: winY + FRAME, bottom: 0 })} />
        <View style={mask({ position: 'absolute', top: winY, height: FRAME, left: 0, width: winX })} />
        <View style={mask({ position: 'absolute', top: winY, height: FRAME, right: 0, width: winX })} />

        {/* corner brackets */}
        <View style={{ position: 'absolute', left: winX, top: winY, width: FRAME, height: FRAME }}>
          <View style={[styles.bracket, styles.tl, { borderTopLeftRadius: 12 }]} />
          <View style={[styles.bracket, styles.tr, { borderTopRightRadius: 12 }]} />
          <View style={[styles.bracket, styles.bl, { borderBottomLeftRadius: 12 }]} />
          <View style={[styles.bracket, styles.br, { borderBottomRightRadius: 12 }]} />
        </View>
      </View>

      {/* header */}
      <View style={styles.header}>
        <Pressable style={styles.btn} onPress={close} hitSlop={10}>
          <CloseIcon size={16} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.title}>Scan QR code</Text>
        <Pressable style={styles.btn} onPress={openGallery} disabled={decoding} hitSlop={10}>
          {decoding ? <ActivityIndicator size="small" color="#FFFFFF" /> : <GalleryIcon size={22} color="#FFFFFF" />}
        </Pressable>
        <Pressable style={styles.btn} onPress={() => setTorch((v) => !v)} hitSlop={10}>
          <FlashIcon size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* home gesture bar */}
      <View style={styles.gesture} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0E' },
  center: { alignItems: 'center', justifyContent: 'center' },
  maskLayer: StyleSheet.absoluteFill as object,
  mask: { backgroundColor: 'rgba(10,10,14,0.62)' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16, gap: 12 },
  btn: { width: BTN, height: BTN, borderRadius: BTN / 2, backgroundColor: 'rgba(51,51,51,0.5)', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: '#FFFFFF', fontSize: 17, fontFamily: 'Inter-500', fontWeight: '500' },
  bracket: { position: 'absolute', width: 36, height: 36, borderColor: '#FFFFFF', borderWidth: BRACKET, opacity: 0.98 },
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
