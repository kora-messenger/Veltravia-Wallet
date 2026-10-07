/**
 * Veltravia Wallet — onboarding entry point.
 * Create wallet → seed reveal/confirm → PIN; or import existing wallet.
 * Phase 2 builds the full flow; this is the routed entry screen.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';

export default function WelcomeScreen() {
  const { theme } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        <Text style={[styles.logo, { color: theme.brand }]}>Veltravia</Text>
        <Text style={[styles.tagline, { color: theme.inkMuted }]}>
          Your keys. Your crypto.
        </Text>
        <Pressable style={[styles.primaryBtn, { backgroundColor: theme.brand }]}>
          <Text style={styles.primaryBtnText}>Create a new wallet</Text>
        </Pressable>
        <Pressable style={[styles.secondaryBtn, { borderColor: theme.border }]}>
          <Text style={[styles.secondaryBtnText, { color: theme.ink }]}>
            I already have a wallet
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { fontSize: 34, fontWeight: '800', marginBottom: 8 },
  tagline: { fontSize: 14, marginBottom: 48 },
  primaryBtn: {
    width: '100%', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    width: '100%', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
});
