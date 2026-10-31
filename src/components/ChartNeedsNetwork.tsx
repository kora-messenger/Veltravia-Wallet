/**
 * Veltravia Wallet - what the chart area shows when the device is offline.
 *
 * A price chart with no connection is a lie, so the chart is replaced (not
 * overlaid) and the user is told what to do. Retry re-runs the connectivity
 * check; returning to the app does it automatically.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { WifiOffIcon } from './icons';

export default function ChartNeedsNetwork({
  height = 240,
  onRetry,
  retrying = false,
}: {
  height?: number;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';

  return (
    <View
      testID="chartNeedsNetwork"
      accessible
      accessibilityRole="alert"
      accessibilityLabel="Charts need a connection. You are offline."
      style={[styles.root, { height }]}
    >
      <View style={[styles.badge, { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#F1F1F4' }]}>
        <WifiOffIcon size={22} color={theme.inkMuted} />
      </View>
      <Text style={[styles.title, { color: theme.ink }]}>You're offline</Text>
      <Text style={[styles.body, { color: theme.inkMuted }]}>
        Charts need a connection. Your candles will load as soon as you're back online.
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel="Retry loading the chart"
          hitSlop={8}
          style={({ pressed }) => [
            styles.retry,
            { backgroundColor: theme.brand, opacity: retrying ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.retryText}>{retrying ? 'Checking…' : 'Retry'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', marginBottom: 4 },
  body: { fontSize: 13, lineHeight: 18, textAlign: 'center', fontFamily: 'Inter-400' },
  retry: { marginTop: 14, paddingHorizontal: 18, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
});
