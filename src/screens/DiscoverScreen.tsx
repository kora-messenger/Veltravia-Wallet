/**
 * Veltravia Wallet — Discover tab. v2 feature; ships as designed "coming soon".
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export default function DiscoverScreen() {
  const { theme } = useTheme();
  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: theme.ink }]}>Discover</Text>
        <Text style={[styles.sub, { color: theme.inkMuted }]}>
          DApps and Web3 discovery arrive in a Veltravia update.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 28, fontFamily: 'Inter-700', fontWeight: '800', marginBottom: 8, lineHeight: 39 },
  sub: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500', textAlign: 'center' },
});
