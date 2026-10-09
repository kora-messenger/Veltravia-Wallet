/**
 * Veltravia Wallet — "Select recovery method".
 *
 * Mirrors Trust's restore-method list (title locked to Ijezie's wording):
 * Google Drive, Secret phrase (Seed), Private key, Swift wallet, Keystore,
 * View-only wallet + a Show less / Show more toggle.
 *
 * Swift wallet behaves exactly like Trust's on a device with no registered
 * Swift wallet: the row goes into a skeleton loading state, the OS
 * credential prompt opens, and no matter how it ends the red message
 * "Couldn't restore your Swift wallet. Please try again." appears under
 * the last option — and stays until the user leaves this screen.
 *
 * Secret phrase routes to the existing seed import screen. The other
 * methods land with their own screens in the next build phases; for now
 * they show an honest inline "coming soon" note.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import {
  BackIcon,
  DriveTriangleIcon,
  ShieldCheckIcon,
  KeyIcon,
  BoltIcon,
  KeystoreFileIcon,
  EyeIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '../components/icons';
import { promptBiometrics, isBiometricsSupported } from '../core/security/biometrics';

const RED = '#E5484D';
const SWIFT_ERROR = "Couldn't restore your Swift wallet. Please try again.";

type Method = {
  key: string;
  label: string;
  icon: (p: { size?: number; color?: string }) => React.ReactElement;
};

const ALL: Method[] = [
  { key: 'gdrive', label: 'Google Drive', icon: DriveTriangleIcon },
  { key: 'seed', label: 'Secret phrase (Seed)', icon: ShieldCheckIcon },
  { key: 'key', label: 'Private key', icon: KeyIcon },
  { key: 'swift', label: 'Swift wallet', icon: BoltIcon },
  { key: 'keystore', label: 'Keystore', icon: KeystoreFileIcon },
  { key: 'viewonly', label: 'View-only wallet', icon: EyeIcon },
];
const COLLAPSED_COUNT = 3;

export default function SelectRecoveryMethodScreen({
  onBack,
  onSecretPhrase,
}: {
  onBack: () => void;
  onSecretPhrase: () => void;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(true);
  const [swiftLoading, setSwiftLoading] = useState(false);
  const [swiftError, setSwiftError] = useState(false);
  const [toast, setToast] = useState('');
  const shimmer = useRef(new Animated.Value(0.5)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // skeleton shimmer loop while Swift wallet "checks" for a wallet
  useEffect(() => {
    if (!swiftLoading) return;
    shimmer.setValue(0.5);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.5, duration: 550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [swiftLoading, shimmer]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showComingSoon = useCallback((label: string) => {
    setToast(`${label} restore is coming soon.`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

  const onSwift = useCallback(async () => {
    if (swiftLoading) return;
    setSwiftLoading(true);
    const supported = await isBiometricsSupported();
    const finish = () => {
      setSwiftLoading(false);
      // No Veltravia keystore is registered for any credential yet —
      // same as Trust on a fresh device: the restore can only fail.
      setSwiftError(true);
    };
    if (!supported) {
      setTimeout(finish, 900);
      return;
    }
    setTimeout(async () => {
      await promptBiometrics('Veltravia Wallet', 'Restore your Swift wallet');
      finish();
    }, 900);
  }, [swiftLoading]);

  const rows = expanded ? ALL : ALL.slice(0, COLLAPSED_COUNT);

  const pressRow = (m: Method) => {
    if (swiftLoading) return;
    if (m.key === 'seed') {
      onSecretPhrase();
    } else if (m.key === 'swift') {
      onSwift();
    } else {
      showComingSoon(m.label);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Pressable hitSlop={14} onPress={onBack} style={styles.back}>
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Select recovery method</Text>
      </View>

      <View style={styles.list}>
        {rows.map((m) =>
          m.key === 'swift' && swiftLoading ? (
            <View key={m.key} style={[styles.row, styles.skeletonRow]}>
              <Animated.View style={[styles.skCircle, { opacity: shimmer }]} />
              <View style={styles.skLeft}>
                <Animated.View style={[styles.skBar, styles.skTitle, { opacity: shimmer }]} />
                <Animated.View style={[styles.skBar, styles.skSub, { opacity: shimmer }]} />
              </View>
              <View style={styles.skRight}>
                <Animated.View style={[styles.skBar, styles.skRightBar, { opacity: shimmer }]} />
                <Animated.View style={[styles.skBar, styles.skRightBar, { opacity: shimmer }]} />
              </View>
            </View>
          ) : (
            <Pressable
              key={m.key}
              onPress={() => pressRow(m)}
              disabled={swiftLoading}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
              android_ripple={{ color: theme.border }}
            >
              <View style={styles.rowIconWrap}>
                {m.key === 'gdrive' ? (
                  <DriveTriangleIcon size={22} color={theme.brand} />
                ) : (
                  React.createElement(m.icon, { size: 22, color: theme.ink })
                )}
              </View>
              <Text style={[styles.rowLabel, { color: theme.ink }]}>{m.label}</Text>
              <ChevronRightDisabled />
            </Pressable>
          ),
        )}

        <Pressable
          onPress={() => setExpanded((e) => !e)}
          disabled={swiftLoading}
          style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.toggleText, { color: theme.ink }]}>{expanded ? 'Show less' : 'Show more'}</Text>
          {expanded ? (
            <ChevronUpIcon size={16} color={theme.inkMuted} />
          ) : (
            <ChevronDownIcon size={16} color={theme.inkMuted} />
          )}
        </Pressable>

        {swiftError && (
          <Text style={[styles.swiftError, { color: RED }]}>{SWIFT_ERROR}</Text>
        )}
      </View>

      {swiftLoading && <View style={styles.dim} pointerEvents="none" />}

      {toast ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={[styles.toast, { backgroundColor: theme.surfaceAlt }]}>
            <Text style={[styles.toastText, { color: theme.ink }]}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** Silent trailing chevron slot — keeps row rhythm even when hidden. */
function ChevronRightDisabled() {
  return <View style={{ width: 24 }} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 88, justifyContent: 'center' },
  back: { position: 'absolute', left: 20, top: 30, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-700', textAlign: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  row: {
    height: 64,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  rowIconWrap: { width: 44, alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 15.5, fontFamily: 'Inter-500' },
  toggle: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  toggleText: { fontSize: 14, fontFamily: 'Inter-600' },
  swiftError: {
    fontSize: 13.5,
    fontFamily: 'Inter-500',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  /* skeleton */
  skeletonRow: { justifyContent: 'flex-start', gap: 14 },
  skCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(120,120,140,0.35)', marginLeft: 10 },
  skLeft: { flex: 1, gap: 8 },
  skRight: { gap: 8, marginRight: 14 },
  skBar: { height: 12, borderRadius: 6, backgroundColor: 'rgba(120,120,140,0.30)' },
  skTitle: { width: 140 },
  skSub: { width: 90, height: 10 },
  skRightBar: { width: 56, height: 10 },
  dim: { ...StyleSheet.absoluteFill as any, backgroundColor: 'rgba(0,0,0,0.18)' },
  toastWrap: { position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center' },
  toast: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  toastText: { fontSize: 13, fontFamily: 'Inter-500' },
});
