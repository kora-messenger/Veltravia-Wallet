/**
 * Veltravia Wallet — global toast.
 *
 * Every message/warning in the app appears here: a dark pill at the TOP of the
 * screen with a coloured status disc, exactly like Trust Wallet's "Address
 * copied" (measured from Ijezie's screenshot): near-black pill, full radius,
 * ~29dp tall, centred, 16dp green check disc on the left, ~52dp from the top.
 *
 * Call `showToast('Address copied')` from anywhere, no hook needed.
 *
 * The host renders inside its own transparent <Modal> while a toast is on
 * screen. Native modals (Receive sheet, filter sheets...) sit above the React
 * root on Android, so a plain overlay would be hidden behind them; a Modal
 * opened later is stacked on top, which keeps the toast visible over sheets.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  duration: number;
}

type Listener = (t: ToastItem | null) => void;
let listener: Listener | null = null;
let seq = 0;

/** Show a toast from anywhere. A new toast replaces the current one. */
export function showToast(message: string, opts: { kind?: ToastKind; duration?: number } = {}) {
  const item: ToastItem = {
    id: ++seq,
    message,
    kind: opts.kind ?? 'success',
    duration: opts.duration ?? 2000,
  };
  listener?.(item);
}

const DISC: Record<ToastKind, string> = {
  success: '#22BE7C',
  error: '#EF4B4B',
  info: '#6C8CFF',
};

function Disc({ kind }: { kind: ToastKind }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Circle cx="8" cy="8" r="8" fill={DISC[kind]} />
      {kind === 'success' && (
        <Path d="M4.6 8.3l2.2 2.2 4.6-4.8" stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      )}
      {kind === 'error' && (
        <>
          <Path d="M8 4.2v4.4" stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="round" />
          <Circle cx="8" cy="11.3" r="1" fill="#FFFFFF" />
        </>
      )}
      {kind === 'info' && (
        <>
          <Path d="M8 7.2v4.4" stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="round" />
          <Circle cx="8" cy="4.8" r="1" fill="#FFFFFF" />
        </>
      )}
    </Svg>
  );
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<ToastItem | null>(null);
  const [mounted, setMounted] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(-10)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = (t) => {
      if (timer.current) clearTimeout(timer.current);
      if (!t) return;
      setItem(t);
      setMounted(true);
      opacity.setValue(0);
      lift.setValue(-10);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      timer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(lift, { toValue: -10, duration: 200, useNativeDriver: true }),
        ]).start(() => setMounted(false));
      }, t.duration);
    };
    return () => {
      listener = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [opacity, lift]);

  if (!mounted || !item) return null;

  // Trust: pill top ~52dp from the screen top, i.e. just under the status bar.
  const statusH = Platform.OS === 'android' ? (StatusBar.currentHeight ?? insets.top) : insets.top;
  const top = Math.max(statusH, insets.top) + 8;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent hardwareAccelerated onRequestClose={() => {}}>
      {/* pointerEvents none on the wrapper: touches fall through to the sheet below */}
      <View style={styles.fill} pointerEvents="none">
        <Animated.View style={[styles.pill, { top, opacity, transform: [{ translateY: lift }] }]}>
          <Disc kind={item.kind} />
          <Text style={styles.text} numberOfLines={2}>
            {item.message}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center' },
  pill: {
    position: 'absolute',
    maxWidth: '88%',
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 7,
    paddingRight: 14,
    borderRadius: 18,
    backgroundColor: '#1C1D22',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: { color: '#FFFFFF', fontSize: 13.5, lineHeight: 18, fontFamily: 'Inter-600', fontWeight: '600', flexShrink: 1 },
});
