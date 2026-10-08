/**
 * Veltravia Wallet — Manage wallet.
 *
 * Edit a wallet's name, colour and icon. Shares the picker visuals with
 * "Name your wallet". Changes save on Done and the header pill updates
 * immediately if this is the active wallet.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { useWallets } from '../../wallets/WalletsProvider';
import {
  WALLET_GLYPHS,
  WALLET_COLORS,
  GLYPH_ORDER,
  COLOR_ORDER,
  WalletGlyphKey,
  WalletColorKey,
} from '../../wallets/WalletGlyphs';
import { WalletAvatar } from '../../wallets/WalletAvatar';
import { BackIcon, CloseIcon } from '../../components/icons';

const NAME_LIMIT = 24;

export default function ManageWalletScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params: { walletId: string } };
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { wallets, updateWallet } = useWallets();
  const wallet = wallets.find((w) => w.id === route.params.walletId);

  const [name, setName] = useState(wallet?.name ?? '');
  const [icon, setIcon] = useState<string>(wallet?.icon ?? 'wallet');
  const [color, setColor] = useState<string>(wallet?.color ?? 'veltravia');

  if (!wallet) return null;

  const dark = theme.mode === 'dark';
  const surface = dark ? theme.surfaceAlt : theme.surface;
  const isDefault = wallet.origin === 'default';
  const dirty = name.trim() !== wallet.name || icon !== wallet.icon || color !== wallet.color;

  const save = () => {
    updateWallet(wallet.id, { name, icon, color });
    navigation.goBack();
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Manage wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.previewWrap}>
          <WalletAvatar icon={icon} color={color} size={96} />
        </View>

        {/* The built-in Veltravia wallet keeps its logo; only its name is editable. */}
        {!isDefault && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
            {COLOR_ORDER.map((c) => {
              const selected = c === color;
              return (
                <Pressable key={c} onPress={() => setColor(c)} style={styles.colorTouch}>
                  <View
                    style={{
                      width: selected ? 40 : 28,
                      height: selected ? 40 : 28,
                      borderRadius: selected ? 20 : 14,
                      backgroundColor: WALLET_COLORS[c as WalletColorKey],
                    }}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={[styles.field, { backgroundColor: surface, borderColor: theme.border }]}>
          <TextInput
            value={name}
            onChangeText={(t) => setName(t.slice(0, NAME_LIMIT))}
            placeholder="Wallet name"
            placeholderTextColor={theme.inkMuted}
            style={[styles.input, { color: theme.ink }]}
          />
          {name.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setName('')} style={styles.clear}>
              <CloseIcon size={14} color={theme.inkMuted} strokeWidth={2.4} />
            </Pressable>
          )}
          <Text style={[styles.counter, { color: theme.inkMuted }]}>
            {name.length}/{NAME_LIMIT}
          </Text>
        </View>

        {!isDefault && (
          <View style={styles.grid}>
            {GLYPH_ORDER.map((g) => {
              const Glyph = WALLET_GLYPHS[g];
              const selected = g === icon;
              return (
                <Pressable key={g} onPress={() => setIcon(g as WalletGlyphKey)} style={styles.gridTouch}>
                  <View
                    style={[
                      styles.gridTile,
                      { backgroundColor: selected ? WALLET_COLORS[color as WalletColorKey] : 'transparent' },
                    ]}
                  >
                    <Glyph size={26} color={selected ? 'rgba(255,255,255,0.96)' : theme.ink} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 12, paddingHorizontal: 20 }}>
        <Pressable
          disabled={!dirty || !name.trim()}
          style={({ pressed }) => [
            styles.doneBtn,
            { backgroundColor: theme.brandGradient[0], opacity: !dirty || !name.trim() ? 0.4 : pressed ? 0.85 : 1 },
          ]}
          onPress={save}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },

  body: { paddingHorizontal: 20, paddingBottom: 24 },
  previewWrap: { alignItems: 'center', marginTop: 4, marginBottom: 14 },
  colorRow: { alignItems: 'center', paddingBottom: 6 },
  colorTouch: { width: 56, height: 44, alignItems: 'center', justifyContent: 'center' },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.4,
    paddingHorizontal: 14,
    height: 54,
    marginTop: 14,
    marginBottom: 22,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 0 },
  clear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(140,146,170,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  counter: { fontSize: 12, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridTouch: { width: '20%', alignItems: 'center', marginBottom: 14 },
  gridTile: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },

  doneBtn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
