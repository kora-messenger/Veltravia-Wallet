/**
 * Veltravia Wallet — Manage account.
 *
 * Opened from the wallet "..." popup.
 *  - Swipeable carousel: the selected avatar is large, ringed and carries a
 *    pencil badge; tapping a colour circle selects it, tapping the avatar
 *    cycles its icon.
 *  - Name field (counter · centered name · clear).
 *  - Back up row, Show secret phrase row (opens the acknowledgement gate).
 *  - Warning card while the wallet is not backed up.
 *  - Pinned "Remove account" pill (confirmation first; the built-in
 *    Veltravia wallet cannot be removed).
 * Name, colour and icon save as you change them.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { useWallets } from '../../wallets/WalletsProvider';
import { WALLET_COLORS, COLOR_ORDER, GLYPH_ORDER, WalletColorKey } from '../../wallets/WalletGlyphs';
import { WalletAvatar } from '../../wallets/WalletAvatar';
import SecretPhraseGateSheet from '../../components/SecretPhraseGateSheet';
import {
  BackIcon,
  CloseIcon,
  PencilIcon,
  CloudUploadIcon,
  ScanFaceIcon,
  AlertCircleIcon,
} from '../../components/icons';

const NAME_LIMIT = 24;
const BIG = 76;
const SMALL = 62;
const GAP = 22;

export default function ManageAccountScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params: { walletId: string } };
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { wallets, updateWallet, removeWallet } = useWallets();
  const wallet = wallets.find((w) => w.id === route.params.walletId);

  const [name, setName] = useState(wallet?.name ?? '');
  const [gateOpen, setGateOpen] = useState(false);
  const inputRef = useRef<{ focus: () => void } | null>(null);

  if (!wallet) return null;

  const dark = theme.mode === 'dark';
  const isDefault = wallet.origin === 'default';
  const chipBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(60,64,90,0.08)';
  const fieldBg = dark ? 'rgba(255,255,255,0.08)' : '#EEEEF2';
  const rowIconBg = dark ? 'rgba(255,255,255,0.08)' : '#EFEFF3';
  const brand = theme.brandGradient[0];
  const pageBg = dark ? theme.background : '#FCFCFD';

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(wallet.name);
      return;
    }
    if (trimmed !== wallet.name) updateWallet(wallet.id, { name: trimmed });
  };

  const cycleIcon = () => {
    if (isDefault) return;
    const i = GLYPH_ORDER.indexOf(wallet.icon as (typeof GLYPH_ORDER)[number]);
    updateWallet(wallet.id, { icon: GLYPH_ORDER[(i + 1) % GLYPH_ORDER.length] });
  };

  const confirmRemove = () => {
    if (isDefault) {
      Alert.alert('Cannot remove', 'The Veltravia Wallet is your primary account and cannot be removed.');
      return;
    }
    Alert.alert(
      'Remove account?',
      wallet.backedUp
        ? `"${wallet.name}" will be removed from this device. You can restore it with your secret phrase.`
        : `"${wallet.name}" is not backed up. If you remove it you could lose access to its funds permanently.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeWallet(wallet.id);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const showBackupInfo = () =>
    Alert.alert(
      'Back up wallet',
      'Secure backup arrives with the Wallet Core integration. Until then, keep your device safe.',
      [{ text: 'OK' }],
    );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: pageBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* ---------- Header ---------- */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          hitSlop={10}
          onPress={() => {
            commitName();
            navigation.goBack();
          }}
          style={[styles.backBtn, { backgroundColor: chipBg }]}
        >
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <View style={[styles.titleWrap, { top: insets.top + 8 }]} pointerEvents="none">
          <Text style={[styles.title, { color: theme.ink }]}>Manage account</Text>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
      >
        {/* ---------- Avatar carousel ---------- */}
        {isDefault ? (
          <View style={styles.singleAvatar}>
            <View style={styles.ring}>
              <WalletAvatar icon={wallet.icon} color={wallet.color} size={BIG} />
            </View>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
            keyboardShouldPersistTaps="handled"
          >
            {COLOR_ORDER.map((c) => {
              const selected = c === wallet.color;
              const hex = WALLET_COLORS[c as WalletColorKey];
              if (selected) {
                return (
                  <Pressable key={c} onPress={cycleIcon} style={styles.ring}>
                    <WalletAvatar icon={wallet.icon} color={c} size={BIG} />
                    <View style={styles.pencil}>
                      <PencilIcon size={14} color="#FFFFFF" />
                    </View>
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={c}
                  onPress={() => updateWallet(wallet.id, { color: c })}
                  style={[styles.dot, { backgroundColor: hex }]}
                />
              );
            })}
          </ScrollView>
        )}

        {/* ---------- Name field ---------- */}
        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={[styles.field, { backgroundColor: fieldBg }]}
        >
          <Text style={[styles.counter, { color: theme.inkMuted }]}>{NAME_LIMIT - name.length}</Text>
          <TextInput
            ref={(r) => {
              inputRef.current = r;
            }}
            value={name}
            onChangeText={(t) => setName(t.slice(0, NAME_LIMIT))}
            onBlur={commitName}
            onSubmitEditing={commitName}
            returnKeyType="done"
            maxLength={NAME_LIMIT}
            style={[styles.input, { color: theme.ink }]}
            selectionColor={brand}
          />
          <Pressable
            hitSlop={10}
            onPress={() => {
              setName('');
              inputRef.current?.focus();
            }}
            style={styles.clear}
          >
            <CloseIcon size={13} color="#FFFFFF" strokeWidth={2.8} />
          </Pressable>
        </Pressable>

        {/* ---------- Back up row ---------- */}
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: rowIconBg }]}>
            <CloudUploadIcon size={24} color={theme.ink} />
            {!wallet.backedUp && <View style={[styles.redDot, { borderColor: rowIconBg }]} />}
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: theme.ink }]}>Back up to Google Drive</Text>
            <Text style={[styles.rowSub, { color: theme.inkMuted }]}>Never lose access to your wallet.</Text>
          </View>
          <Pressable
            onPress={showBackupInfo}
            style={({ pressed }) => [styles.pill, { backgroundColor: brand, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.pillText}>Back up</Text>
          </Pressable>
        </View>

        {/* ---------- Show secret phrase ---------- */}
        <Pressable style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setGateOpen(true)}>
          <View style={[styles.rowIcon, { backgroundColor: rowIconBg }]}>
            <ScanFaceIcon size={24} color={theme.ink} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: theme.ink }]}>Show secret phrase</Text>
            <Text style={[styles.rowSub, { color: theme.inkMuted }]}>Password or biometric required</Text>
          </View>
        </Pressable>

        {/* ---------- Warning ---------- */}
        {!wallet.backedUp && (
          <View style={[styles.warning, { backgroundColor: dark ? 'rgba(245,166,35,0.12)' : '#F6E8DE' }]}>
            <AlertCircleIcon size={20} color="#B25A00" />
            <Text style={[styles.warningText, { color: theme.ink }]}>
              Always back up your wallet so you won't lose access if you lose or reset your device.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ---------- Pinned Remove account ---------- */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={confirmRemove}
          style={({ pressed }) => [
            styles.remove,
            { backgroundColor: dark ? 'rgba(229,57,53,0.16)' : '#F8D9D9', opacity: isDefault ? 0.5 : pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={styles.removeText}>Remove account</Text>
        </Pressable>
      </View>

      <SecretPhraseGateSheet
        visible={gateOpen}
        onClose={() => setGateOpen(false)}
        onContinue={() => {
          setGateOpen(false);
          Alert.alert(
            'Secret phrase',
            'Phrase reveal needs device authentication and the Wallet Core key store, which arrive in the next phase.',
            [{ text: 'OK' }],
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: { paddingHorizontal: 16, paddingBottom: 12, minHeight: 64 },
  backBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { position: 'absolute', left: 0, right: 0, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },

  body: { paddingBottom: 24 },

  carousel: { alignItems: 'center', paddingHorizontal: 20, gap: GAP, paddingVertical: 14 },
  singleAvatar: { alignItems: 'center', paddingVertical: 14 },
  ring: {
    width: BIG + 12,
    height: BIG + 12,
    borderRadius: (BIG + 12) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(140,146,170,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pencil: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0B0B12',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: SMALL, height: SMALL, borderRadius: SMALL / 2 },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 66,
    borderRadius: 18,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 22,
    paddingHorizontal: 18,
  },
  counter: { fontSize: 15, fontWeight: '600', width: 28 },
  input: { flex: 1, textAlign: 'center', fontSize: 19, fontWeight: '800', letterSpacing: -0.3, paddingVertical: 0 },
  clear: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(140,146,170,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 14 },
  rowIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  redDot: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#E53935',
    borderWidth: 2,
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  rowSub: { fontSize: 14 },
  pill: { height: 46, paddingHorizontal: 20, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  pillText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    marginHorizontal: 20,
    marginTop: 18,
    padding: 18,
  },
  warningText: { flex: 1, fontSize: 15, fontWeight: '500', lineHeight: 21 },

  footer: { paddingHorizontal: 20, paddingTop: 10 },
  remove: { height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#D32F2F', fontSize: 18, fontWeight: '700' },
});
