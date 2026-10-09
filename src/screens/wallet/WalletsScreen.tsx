/**
 * Veltravia Wallet — Wallets screen (wallet switcher).
 *
 * Header: close · centered "Wallets" · support · settings.
 * Body:   "Multi-coin wallets" section, one row per wallet
 *         (radio · avatar · name · "..." in a grey circle).
 * Footer: divider + full-width grey "Add wallet" pill pinned to the bottom.
 * Tapping a row switches to that wallet and returns to Home.
 */

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { useWallets } from '../../wallets/WalletsProvider';
import { WalletAvatar } from '../../wallets/WalletAvatar';
import AddWalletSheet from '../../components/AddWalletSheet';
import WalletActionMenu, { MenuAnchor } from '../../components/WalletActionMenu';
import { CloseIcon, SupportIcon, GearIcon, MoreIcon } from '../../components/icons';

export default function WalletsScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { wallets, activeWallet, switchWallet } = useWallets();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuWalletId, setMenuWalletId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const moreRefs = useRef<Record<string, { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null>>({});
  const menuWallet = wallets.find((w) => w.id === menuWalletId) ?? null;

  const openMenu = (id: string) => {
    moreRefs.current[id]?.measureInWindow((x, y, w, h) => {
      setAnchor({ y: y + h, right: x + w });
      setMenuWalletId(id);
    });
  };

  const dark = theme.mode === 'dark';
  const chipBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(60,64,90,0.08)';
  const pillBg = dark ? 'rgba(255,255,255,0.10)' : '#EDEDF1';
  const dotColor = dark ? '#8E96AD' : '#6B6F85';
  const pageBg = dark ? theme.background : '#FCFCFD';

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* ---------- Header ---------- */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()} style={[styles.headerBtn, { backgroundColor: chipBg }]}>
          <CloseIcon size={24} color={theme.ink} />
        </Pressable>
        <View style={[styles.titleWrap, { top: insets.top + 8 }]} pointerEvents="none">
          <Text style={[styles.title, { color: theme.ink }]}>Wallets</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable hitSlop={10} style={[styles.headerBtn, { backgroundColor: chipBg }]}>
            <SupportIcon size={24} color={theme.ink} />
          </Pressable>
          <Pressable hitSlop={10} style={[styles.headerBtn, { backgroundColor: chipBg }]}>
            <GearIcon size={24} color={theme.ink} />
          </Pressable>
        </View>
      </View>

      {/* ---------- List ---------- */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Text style={[styles.section, { color: theme.ink }]}>Multi-coin wallets</Text>

        {wallets.map((w) => {
          const active = w.id === activeWallet.id;
          const ring = active ? theme.brandGradient[0] : '#8A8EA3';
          return (
            <Pressable
              key={w.id}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => {
                switchWallet(w.id);
                navigation.goBack();
              }}
            >
              <View style={[styles.radio, { borderColor: ring }]}>
                {active && <View style={[styles.radioDot, { backgroundColor: ring }]} />}
              </View>
              <WalletAvatar icon={w.icon} color={w.color} size={48} />
              <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                {w.name}
              </Text>
              <Pressable
                ref={(r) => {
                  moreRefs.current[w.id] = r;
                }}
                collapsable={false}
                hitSlop={6}
                onPress={() => openMenu(w.id)}
                style={[styles.moreBtn, { backgroundColor: pillBg }]}
              >
                <MoreIcon size={24} color={dotColor} />
                {!w.backedUp && <View style={[styles.badge, { borderColor: pageBg }]} />}
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ---------- Pinned footer: divider + Add wallet pill ---------- */}
      <View style={[styles.footer, { borderTopColor: theme.border, paddingBottom: insets.bottom + 12, backgroundColor: pageBg }]}>
        <Pressable
          style={({ pressed }) => [styles.addPill, { backgroundColor: pillBg, opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setSheetOpen(true)}
        >
          <Text style={[styles.addLabel, { color: theme.ink }]}>Add wallet</Text>
        </Pressable>
      </View>

      <WalletActionMenu
        visible={!!menuWallet}
        anchor={anchor}
        showBackupBadge={!!menuWallet && !menuWallet.backedUp}
        onClose={() => setMenuWalletId(null)}
        onManage={() => {
          const id = menuWalletId;
          setMenuWalletId(null);
          if (id) navigation.navigate('ManageAccount', { walletId: id });
        }}
        onBackup={() => {
          setMenuWalletId(null);
          Alert.alert(
            'Back up wallet',
            'Secure backup (recovery phrase reveal and verification) arrives with the Wallet Core integration.',
            [{ text: 'OK' }],
          );
        }}
      />

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
    paddingBottom: 10,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', gap: 12, marginLeft: 'auto' },

  list: { paddingTop: 6, paddingBottom: 24 },
  section: {
    fontSize: 16,
    fontFamily: 'Inter-700', fontWeight: '700',
    letterSpacing: -0.2,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    paddingVertical: 8,
    gap: 12,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 14, height: 14, borderRadius: 7 },
  rowName: { flex: 1, fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600', letterSpacing: -0.2 },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E53935',
    borderWidth: 2,
  },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    paddingHorizontal: 20,
  },
  addPill: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600', letterSpacing: -0.2 },
});
