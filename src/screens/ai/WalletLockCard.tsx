/**
 * Veltravia AI — wallet lock / unlock approval card.
 *
 * Two-step money-safety gate:
 *   1. the user types their SECURITY PASSWORD (a text password, separate from
 *      the 6-digit lock-screen passcode and from biometrics) and taps Approve;
 *   2. only after the password checks out does the app run the normal
 *      biometric / passcode verification as the final step.
 * The AI can only REQUEST the state change; nothing happens before both
 * steps pass. Resolved cards render read-only.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput, Animated, Easing } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { CheckIcon, CloseIcon, ShieldLockIcon } from '../../components/icons';
import type { ChatMessage } from '../../ai/protocol';

const GREEN = '#12915E';
const RED = '#E5484D';

export default function WalletLockCard({
  lock,
  resolved,
  busy,
  noPassword,
  error,
  walletName,
  onApprove,
  onSetup,
  onReject,
  onOpenSettings,
}: {
  /** true = locking the wallet; false = unlocking it. */
  lock: boolean;
  resolved?: ChatMessage['resolved'];
  busy: boolean;
  /** No security password set yet: card points the user to Settings. */
  noPassword?: boolean;
  /** Verification failed: shake + red line, card stays open for retry. */
  error?: string | null;
  /** Wallet this lock applies to (each wallet has its own AI + password). */
  walletName?: string;
  onApprove: (password: string) => void;
  /** First use: create the security password right here, then continue. */
  onSetup: (password: string) => void;
  onReject: () => void;
  onOpenSettings: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const panel = dark ? 'rgba(255,255,255,0.07)' : '#F1F1F5';
  const rule = dark ? 'rgba(255,255,255,0.10)' : 'rgba(6,14,44,0.08)';
  const fieldBg = dark ? 'rgba(255,255,255,0.10)' : '#FFFFFF';
  const state = resolved;

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [setupErr, setSetupErr] = useState<string | null>(null);
  const shake = useRef(new Animated.Value(0)).current;

  // Wrong password: shake the field and clear it for another try.
  useEffect(() => {
    if (!error) return;
    setPw('');
    setPw2('');
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 40, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true, easing: Easing.linear }),
    ]).start();
  }, [error, shake]);

  const shakeX = shake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-8, 0, 8],
  });

  return (
    <View style={[styles.card, { backgroundColor: panel }]}>
      <View style={styles.head}>
        <View style={[styles.iconWrap, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : '#FFFFFF' }]}>
          <ShieldLockIcon size={26} color={theme.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: theme.inkMuted }]}>Veltravia AI wants to</Text>
          <Text style={[styles.title, { color: theme.ink }]}>{lock ? 'Lock your wallet' : 'Unlock your wallet'}</Text>
        </View>
      </View>

      <View style={[styles.rule, { backgroundColor: rule }]} />

      <Text style={[styles.body, { color: theme.ink }]}>
        {lock
          ? 'While locked, your wallet keeps its normal look — balances and history stay visible and receiving still works. ' +
            'Sending, swapping and AI transfers are blocked until you unlock again.'
          : 'Unlocking re-enables sending, swapping and AI transfers. Your balances never changed while it was locked.'}
      </Text>

      {noPassword && !state ? (
        <>
          <Text style={[styles.body, { color: theme.ink }]}>
            You haven't set a security password for this wallet yet. Create one below — you'll use it every time you lock or unlock.
          </Text>
          <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
            <TextInput
              value={pw}
              onChangeText={setPw}
              secureTextEntry
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="Security password (min 6 characters)"
              placeholderTextColor={theme.inkMuted}
              selectionColor={theme.brand}
              style={[styles.input, { backgroundColor: fieldBg, color: theme.ink, borderColor: error ? RED : 'transparent' }]}
              editable={!busy}
            />
          </Animated.View>
          <TextInput
            value={pw2}
            onChangeText={setPw2}
            secureTextEntry
            autoCorrect={false}
            autoCapitalize="none"
            placeholder="Confirm password"
            placeholderTextColor={theme.inkMuted}
            selectionColor={theme.brand}
            style={[styles.input, { backgroundColor: fieldBg, color: theme.ink, borderColor: error ? RED : 'transparent' }]}
            editable={!busy}
          />
          {!!(setupErr ?? error) && <Text style={styles.errText}>{setupErr ?? error}</Text>}
          <View style={styles.btnRow}>
            <Pressable
              onPress={onReject}
              disabled={busy}
              style={({ pressed }) => [styles.btn, styles.btnGhost, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : '#E4E4EA', opacity: pressed ? 0.7 : 1 }]}
            >
              <CloseIcon size={18} color={theme.ink} />
              <Text style={[styles.btnText, { color: theme.ink }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (pw.length < 6) return setSetupErr('Use at least 6 characters.');
                if (pw !== pw2) return setSetupErr('Passwords do not match.');
                setSetupErr(null);
                onSetup(pw);
              }}
              disabled={busy || pw.length === 0}
              style={({ pressed }) => [styles.btn, { backgroundColor: GREEN, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <CheckIcon size={18} color="#fff" />}
              <Text style={[styles.btnText, { color: '#fff' }]}>Set password & Approve</Text>
            </Pressable>
          </View>
          <Text style={[styles.timer, { color: theme.inkMuted }]}>
            After Approve, you'll confirm with biometrics or your passcode.
          </Text>
        </>
      ) : !state ? (
        <>
          <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
            <TextInput
              value={pw}
              onChangeText={setPw}
              secureTextEntry
              autoCorrect={false}
              autoCapitalize="none"
              placeholder="Security password"
              placeholderTextColor={theme.inkMuted}
              selectionColor={theme.brand}
              style={[styles.input, { backgroundColor: fieldBg, color: theme.ink, borderColor: error ? RED : 'transparent' }]}
              editable={!busy}
            />
          </Animated.View>
          {!!error && <Text style={styles.errText}>{error}</Text>}
          <View style={styles.btnRow}>
            <Pressable
              onPress={onReject}
              disabled={busy}
              style={({ pressed }) => [styles.btn, styles.btnGhost, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : '#E4E4EA', opacity: pressed ? 0.7 : 1 }]}
            >
              <CloseIcon size={18} color={theme.ink} />
              <Text style={[styles.btnText, { color: theme.ink }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onApprove(pw)}
              disabled={busy || pw.length === 0}
              style={({ pressed }) => [styles.btn, { backgroundColor: GREEN, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <CheckIcon size={18} color="#fff" />}
              <Text style={[styles.btnText, { color: '#fff' }]}>Approve</Text>
            </Pressable>
          </View>
          <Text style={[styles.timer, { color: theme.inkMuted }]}>
            After Approve, you'll confirm with biometrics or your passcode.
          </Text>
        </>
      ) : null}

      {state === 'approved' && (
        <Text style={[styles.status, { color: GREEN }]}>{lock ? 'Approved. Wallet locked.' : 'Approved. Wallet unlocked.'}</Text>
      )}
      {state === 'rejected' && (
        <Text style={[styles.status, { color: theme.inkMuted }]}>Cancelled. Your wallet is unchanged.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500' },
  title: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
  rule: { height: 1, width: '100%' },
  body: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter-400', fontWeight: '400' },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Inter-500',
    fontWeight: '500',
  },
  errText: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500', color: RED },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnGhost: {},
  btnText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  timer: { fontSize: 12, fontFamily: 'Inter-400', fontWeight: '400' },
  status: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
});
