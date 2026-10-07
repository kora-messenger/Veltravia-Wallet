/**
 * Veltravia Wallet — Markets tab (v1: live price list via backend).
 * Phase 1: themed scaffold; Phase 2 wires api.prices().
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export default function MarketsScreen() {
  const { theme } = useTheme();
  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.ink }]}>Markets</Text>
        <Text style={[styles.sub, { color: theme.inkMuted }]}>
          Live prices land here in Phase 2 (api.prices()).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 120 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  sub: { fontSize: 14 },
});
