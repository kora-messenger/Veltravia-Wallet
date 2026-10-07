/**
 * Veltravia Wallet — Settings tab. v1: security, wallet, appearance.
 * Phase 2 wires each row to its real screen from the approved 17-screen map.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export default function SettingsScreen() {
  const { theme, setOverride, isDark } = useTheme();

  const rows = [
    { label: 'Security', detail: 'PIN, biometrics, auto-lock' },
    { label: 'Wallet', detail: 'Backup phrase, addresses' },
    { label: 'Currency', detail: 'USD / NGN' },
    { label: 'Notifications', detail: 'Transfers and alerts' },
    { label: 'About', detail: 'Version and licenses' },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.ink }]}>Settings</Text>

        <Pressable
          style={[styles.row, { backgroundColor: theme.surface }]}
          onPress={() => setOverride(isDark ? 'light' : 'dark')}
        >
          <View>
            <Text style={[styles.rowLabel, { color: theme.ink }]}>Appearance</Text>
            <Text style={[styles.rowDetail, { color: theme.inkMuted }]}>
              {isDark ? 'Dark' : 'Light'} — tap to switch
            </Text>
          </View>
        </Pressable>

        {rows.map((row) => (
          <Pressable
            key={row.label}
            style={[styles.row, { backgroundColor: theme.surface }]}
            onPress={() => {}}
          >
            <View>
              <Text style={[styles.rowLabel, { color: theme.ink }]}>{row.label}</Text>
              <Text style={[styles.rowDetail, { color: theme.inkMuted }]}>{row.detail}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 120 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 20 },
  row: { borderRadius: 16, padding: 16, marginBottom: 10 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowDetail: { fontSize: 12, marginTop: 2 },
});
