/**
 * Veltravia Wallet — Swap tab. v2 feature; ships as designed "coming soon".
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export default function SwapScreen() {
  const { theme } = useTheme();
  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: theme.ink }]}>Swap</Text>
        <Text style={[styles.sub, { color: theme.inkMuted }]}>
          Token swapping arrives in a Veltravia update.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  sub: { fontSize: 14, textAlign: 'center' },
});
