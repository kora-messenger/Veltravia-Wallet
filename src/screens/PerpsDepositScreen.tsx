/**
 * Veltravia Wallet — Perps Deposit / Withdraw.
 *
 * Moves USDC between the main wallet and the separate Perps account. Deposit
 * is bounded by the main wallet's USDC; Withdraw by the free perps balance.
 * Settlement via api.veltraviawallet.com arrives with the Wallet Core signing
 * bridge; until then the transfer updates the local perps account.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { useWallets } from '../wallets/WalletsProvider';
import { BackIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import { MOCK_HOLDINGS } from '../services/portfolio';
import {
  usePerpsAccount, depositToPerps, withdrawFromPerps,
} from '../services/perpsAccount';

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// App violet (#6C63FF) darkened to Trust's button depth for Perps CTAs.
const VIOLET_DEEP = '#5147E6';

export default function PerpsDepositScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mode: 'deposit' | 'withdraw' = route.params?.mode === 'withdraw' ? 'withdraw' : 'deposit';
  const { activeWallet } = useWallets();
  const account = usePerpsAccount(activeWallet.id);
  const [text, setText] = useState('');

  // Main-wallet stablecoin (USDT, $1) available to move into perps.
  const walletUsdc = MOCK_HOLDINGS.find((h) => h.symbol === 'USDT')?.amount ?? 0;
  const max = mode === 'deposit' ? walletUsdc : account.available;
  const amount = parseFloat(text.replace(/,/g, ''));
  const valid = Number.isFinite(amount) && amount > 0 && amount <= max;
  const over = Number.isFinite(amount) && amount > max;

  const submit = () => {
    if (!valid) return;
    if (mode === 'deposit') depositToPerps(activeWallet.id, amount);
    else withdrawFromPerps(activeWallet.id, amount);
    showToast(mode === 'deposit' ? `Deposited ${usd(amount)} to Perps` : `Withdrew ${usd(amount)} to wallet`, { kind: 'success' });
    navigation.goBack();
  };

  const chipBg = dark ? '#1D2133' : '#EEEEF0';
  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()} style={[styles.circle, { backgroundColor: chipBg }]}>
          <BackIcon size={22} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>{mode === 'deposit' ? 'Deposit to Perps' : 'Withdraw from Perps'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.note, { color: theme.inkMuted }]}>
          {mode === 'deposit'
            ? 'Perps uses its own balance, separate from your wallet. Move stablecoin in to start trading.'
            : 'Move free balance from Perps back to your wallet.'}
        </Text>
        <View style={[styles.field, { backgroundColor: chipBg }]}>
          <Text style={[styles.dollar, { color: theme.ink }]}>$</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.inkMuted}
            style={[styles.input, { color: theme.ink }]}
            autoFocus
          />
          <Pressable hitSlop={8} onPress={() => setText(String(max))}>
            <Text style={[styles.maxText, { color: theme.brand }]}>Max</Text>
          </Pressable>
        </View>
        <Text style={[styles.avail, { color: over ? '#D9342B' : theme.inkMuted }]}>
          {over ? 'Amount exceeds available balance' : `${mode === 'deposit' ? 'Wallet balance' : 'Perps available'}: ${usd(max)}`}
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          disabled={!valid}
          onPress={submit}
          style={({ pressed }) => [styles.cta, { backgroundColor: VIOLET_DEEP, opacity: !valid ? 0.4 : pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.ctaText}>{mode === 'deposit' ? 'Deposit' : 'Withdraw'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 28 },
  note: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter-500', fontWeight: '500' },
  field: { flexDirection: 'row', alignItems: 'center', height: 64, borderRadius: 18, paddingHorizontal: 18, marginTop: 22 },
  dollar: { fontSize: 26, fontFamily: 'Inter-700', fontWeight: '700', marginRight: 4 },
  input: { flex: 1, fontSize: 26, fontFamily: 'Inter-700', fontWeight: '700', paddingVertical: 0 },
  maxText: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700' },
  avail: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 10 },
  footer: { paddingHorizontal: 16 },
  cta: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
});
