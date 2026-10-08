/**
 * Veltravia Wallet — Wallets screen (Trust-style switcher).
 *
 * Opened by tapping the home header pill. Lists every wallet account under
 * "Multi-coin wallets": avatar, name, active radio dot, "..." affordance.
 * "Add wallet" at the bottom opens the Add Wallet sheet. Tapping a wallet
 * switches to it and closes the screen.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { useWallets } from '../../wallets/WalletsProvider';
import { WalletAvatar } from '../../wallets/WalletAvatar';
import AddWalletSheet from '../../components/AddWalletSheet';
import { CloseIcon, SupportIcon, SlidersIcon, MoreIcon, PlusIcon } from '../../components/icons';

export default function WalletsScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { wallets, activeWallet, switchWallet } = useWallets();
  const [sheetOpen, setSheetOpen] = useState(false);

    const chipBg = theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(60,64,90,0.08)';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* ---------- Header ---------- */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()} style={[styles.headerBtn, { backgroundColor: chipBg }]}>
          <CloseIcon size={20} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]} pointerEvents="none">Wallets</Text>
        <View style={styles.headerRight}>
          <Pressable hitSlop={10} style={[styles.headerBtn, { backgroundColor: chipBg }]}>
            <SupportIcon size={21} color={theme.ink} />
          </Pressable>
          <Pressable hitSlop={10} style={[styles.headerBtn, { backgroundColor: chipBg }]}>
            <SlidersIcon size={21} color={theme.ink} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.section, { color: theme.ink }]}>Multi-coin wallets</Text>

        {wallets.map((w) => {
          const active = w.id === activeWallet.id;
          return (
            <Pressable
              key={w.id}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => {
                switchWallet(w.id);
                navigation.goBack();
              }}
            >
              <View style={[styles.radio, { borderColor: active ? theme.brandGradient[0] : theme.inkMuted }]}>
                {active && <View style={[styles.radioDot, { backgroundColor: theme.brandGradient[0] }]} />}
              </View>
              <WalletAvatar icon={w.icon} color={w.color} size={44} />
              <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                {w.name}
              </Text>
              <Pressable hitSlop={8} onPress={() => {}} style={[styles.moreBtn, { backgroundColor: chipBg }]}>
                <MoreIcon size={22} color={theme.ink} />
              </Pressable>
            </Pressable>
          );
        })}

        <Pressable
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setSheetOpen(true)}
        >
          <View style={{ width: 24 }} />
          <View style={[styles.plus, { backgroundColor: theme.brandGradient[0] }]}>
            <PlusIcon size={24} color="#FFFFFF" />
          </View>
          <Text style={[styles.addLabel, { color: theme.ink }]}>Add wallet</Text>
        </Pressable>
      </ScrollView>

      <AddWalletSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreate={() => {
          setSheetOpen(false);
          navigation.navigate('NameWallet', { origin: 'created' });
        }}
        onImport={() => {
          setSheetOpen(false);
          navigation.navigate('ImportWallet');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', gap: 10, marginLeft: 'auto' },

  section: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 14,
  },
  rowName: { flex: 1, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  moreBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 14,
  },
  plus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { fontSize: 16, fontWeight: '600' },
});
