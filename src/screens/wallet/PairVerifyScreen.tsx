/**
 * Veltravia Wallet — "Verify Your Device" and the pairing result, on the NEW phone.
 *
 * Three visible stages, and each one is reporting real work rather than a timer:
 *
 *   verify   the six digits from the old device are typed here. Six boxes, one
 *            digit each, paste-aware, auto-advancing, with the attempt count and
 *            every failure spelled out.
 *   securing the handshake is actually running: the sealed box is being fetched
 *            and opened, the phrase is being written to the keystore.
 *   success  "Device Paired Successfully!" only after the wallet is really there.
 *
 * Cancel is available at every stage, and cancelling tells the other device.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { CheckIcon, ShieldLockIcon } from '../../components/icons';
import { beginPairingFromUri, finishPairing, pairFailureMessage, type BeginPairOutcome } from '../../core/security/pairDevice';
import { cancelPairingSession } from '../../core/security/pairingSession';

const LEN = 6;

type Stage = 'verify' | 'securing' | 'success' | 'failed';

export default function PairVerifyScreen({
  uri,
  onCancel,
  onOpenWallet,
  onPaired,
}: {
  /** The scanned pairing code. */
  uri: string;
  onCancel: () => void;
  onOpenWallet: () => void;
  /** Called once the wallet is genuinely on this device. */
  onPaired?: () => void;
}) {
  const { theme } = useTheme();
  const [stage, setStage] = useState<Stage>('verify');
  const [begun, setBegun] = useState<BeginPairOutcome | null>(null);
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<any>(null);
  const cancelled = useRef(false);

  // Announce ourselves on mount. Scanning alone grants nothing.
  useEffect(() => {
    let live = true;
    (async () => {
      const res = await beginPairingFromUri(uri);
      if (!live || cancelled.current) return;
      if (!res.ok) {
        setStage('failed');
        setError(pairFailureMessage(res.reason));
        return;
      }
      setBegun(res.begun);
    })();
    return () => {
      live = false;
    };
  }, [uri]);

  const cancel = useCallback(() => {
    cancelled.current = true;
    const handle = begun?.handle;
    if (handle) {
      // Best effort: the relay row and any pending release die with it.
      cancelPairingSession().catch(() => {});
    }
    onCancel();
  }, [begun, onCancel]);

  const submit = useCallback(async () => {
    if (!begun || busy) return;
    if (!/^[0-9]{6}$/.test(digits)) {
      setError('Enter all six digits shown on your existing device.');
      return;
    }
    setBusy(true);
    setError(null);
    setStage('securing');
    const outcome = await finishPairing(begun, digits, 'This device');
    if (cancelled.current) return;
    setBusy(false);
    if (!outcome.ok) {
      setStage('verify');
      setError(pairFailureMessage(outcome.reason, outcome.attemptsLeft));
      setAttemptsLeft(outcome.attemptsLeft ?? null);
      setDigits('');
      (inputRef.current as unknown as { focus: () => void } | null)?.focus();
      return;
    }
    setStage('success');
    onPaired?.();
  }, [begun, busy, digits, onPaired]);

  const onChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, LEN);
    setDigits(cleaned);
    if (error) setError(null);
  };

  const boxes = Array.from({ length: LEN }, (_, i) => digits[i] ?? '');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          {stage === 'success' ? (
            <View style={styles.center} testID="pairSuccess">
              <View style={[styles.badge, { backgroundColor: `${theme.brand}1F` }]}>
                <CheckIcon size={30} color={theme.brand} />
              </View>
              <Text style={[styles.title, { color: theme.ink }]}>Device Paired Successfully!</Text>
              <Text style={[styles.sub, { color: theme.inkMuted }]}>
                Your Veltravia Wallet is now available on this device.
              </Text>
            </View>
          ) : stage === 'securing' ? (
            <View style={styles.center} testID="pairSecuring">
              <ActivityIndicator size="large" color={theme.brand} />
              <Text style={[styles.title, { color: theme.ink }]}>Securing Your Connection</Text>
              <Text style={[styles.sub, { color: theme.inkMuted }]}>
                We're establishing a secure connection between your devices. Please wait while Veltravia Wallet
                completes the pairing process.
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.badge, { backgroundColor: `${theme.brand}1F` }]}>
                <ShieldLockIcon size={28} color={theme.brand} />
              </View>
              <Text style={[styles.title, { color: theme.ink }]}>Verify Your Device</Text>
              <Text style={[styles.sub, { color: theme.inkMuted }]}>
                Enter the six-digit verification code displayed on your existing device to continue pairing your
                wallet.
              </Text>

              <Pressable
                style={styles.boxes}
                onPress={() => (inputRef.current as unknown as { focus: () => void } | null)?.focus()}
                accessibilityLabel="Six-digit verification code"
              >
                {boxes.map((d, i) => (
                  <View
                    key={i}
                    style={[
                      styles.box,
                      {
                        borderColor: error ? '#E5484D' : d ? theme.brand : theme.border,
                        backgroundColor: theme.surface,
                      },
                    ]}
                    testID={`pairDigit${i}`}
                  >
                    <Text style={[styles.boxText, { color: theme.ink }]}>{d}</Text>
                  </View>
                ))}
                {/* One real input: native paste, native backspace, native IME. */}
                <TextInput
                  ref={inputRef}
                  value={digits}
                  onChangeText={onChange}
                  onSubmitEditing={submit}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  autoFocus
                  maxLength={LEN}
                  style={styles.hiddenInput}
                  testID="pairCodeInput"
                  accessibilityLabel="Six-digit verification code"
                />
              </Pressable>

              {error ? (
                <Text style={[styles.error, { color: '#E5484D' }]} testID="pairError">
                  {error}
                </Text>
              ) : attemptsLeft !== null ? (
                <Text style={[styles.fine, { color: theme.inkMuted }]}>
                  {attemptsLeft} of 5 attempts left for this code.
                </Text>
              ) : null}

              <Text style={[styles.fine, { color: theme.inkMuted }]}>
                Never share this code with anyone. If you did not start this pairing, cancel it.
              </Text>
            </>
          )}
        </View>

        <View style={styles.actions}>
          {stage === 'success' ? (
            <Pressable
              onPress={onOpenWallet}
              style={({ pressed }) => [styles.primary, { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 }]}
              accessibilityLabel="Open Wallet"
            >
              <Text style={styles.primaryText}>Open Wallet</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={cancel}
                style={({ pressed }) => [styles.secondary, { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.8 : 1 }]}
                accessibilityLabel="Cancel pairing"
              >
                <Text style={[styles.secondaryText, { color: theme.ink }]}>Cancel Pairing</Text>
              </Pressable>
              {stage === 'verify' ? (
                <Pressable
                  onPress={submit}
                  disabled={busy || digits.length !== LEN}
                  style={({ pressed }) => [
                    styles.primary,
                    {
                      backgroundColor: theme.brand,
                      opacity: digits.length !== LEN ? 0.4 : pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityLabel="Verify Device"
                >
                  <Text style={styles.primaryText}>Verify Device</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, justifyContent: 'space-between' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center', gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  boxes: { flexDirection: 'row', gap: 8, marginTop: 18 },
  box: {
    width: 46,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: { fontSize: 22, fontWeight: '600' },
  // Kept in the layout but invisible: the boxes above are the visible UI.
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1, left: 0, top: 0 },
  error: { fontSize: 13, textAlign: 'center', marginTop: 6 },
  fine: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingBottom: 24 },
  secondary: { flex: 1, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  primary: { flex: 1, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
