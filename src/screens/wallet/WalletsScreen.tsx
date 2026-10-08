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

  const surface = theme.mode === 'dark' ? theme.surfaceAlt : theme.surface;
  const chipBg = theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(60,64,90,0.08)';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* ---------- Header ---------- */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()} style={[styles.headerBtn, { backgroundColor: chipBg }]}>
          <CloseIcon size={20} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Wallets</Text>
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
        <Text style={[styles.section, { color: theme.inkMuted }]}>Multi-coin wallets</Text>

        {wallets.map((w) => (
          <Pressable
            key={w.id}
            style={({ pressed }) => [styles.row, { backgroundColor: surface, opacity: pressed ? 0.75 : 1 }]}
            onPress={() => {
              switchWallet(w.id);
              navigation.goBack();
            }}
          >
            <WalletAvatar icon={w.icon} color={w.color} size={44} />
            <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
              {w.name}
            </Text>
            <View style={styles.rowRight}>
              <View style={[styles.radio, { borderColor: theme.ink }]}>
                {w.id === activeWallet.id && (
                  <View style={[styles.radioDot, { backgroundColor: theme.ink }]} />
                )}
              </View>
              <Pressable hitSlop={12} onPress={() => {}} style={styles.moreBtn}>
                <MoreIcon size={22} color={theme.inkMuted} />
              </Pressable>
            </View>
          </Pressable>
        ))}

        <Pressable
          style={({ pressed }) => [styles.addBtn, { backgroundColor: surface, borderColor: theme.border, opacity: pressed ? 0.75 : 1 }]}
          onPress={() => setSheetOpen(true)}
        >
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
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, flex: 1 },
  headerRight: { flexDirection: 'row', gap: 8 },

  section: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 14,
  },
  rowName: { flex: 1, fontSize: 16, fontWeight: '600' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 11, height: 11, borderRadius: 5.5 },
  moreBtn: { width: 28, alignItems: 'center' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 14,
    borderWidth: 1.4,
    borderStyle: 'dashed',
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
