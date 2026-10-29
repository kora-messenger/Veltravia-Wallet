/**
 * Veltravia Wallet — the pairing code sheet.
 *
 * Shown on the device that already has the wallet (Manage account, and
 * Settings → Paired devices). Every time it opens it mints a NEW pairing
 * session: a random session id, a fresh ephemeral keypair and a 60 second
 * expiry. The QR carries `sessionId + ephemeral public key + expiry` and
 * nothing else — no recovery phrase, no group key, no private key.
 *
 * The other device scans it and publishes its own ephemeral public key. Both
 * sides then show the same six digits; the owner compares them and confirms
 * here, which is the point at which the group key is sealed to the joiner's
 * key. Closing the sheet cancels the session.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import QrCode from './QrCode';
import AppModal from './AppModal';
import { ensureGroup, getGroup } from '../core/security/walletGroup';
import { authenticateForPairing, pairingAuthOptions } from '../core/security/pairingAuth';
import PasscodeConfirmSheet from '../screens/ai/PasscodeConfirmSheet';
import {
  approveJoiner,
  cancelPairingSession,
  currentPairingSession,
  startPairingSession,
  waitForJoiner,
  type HostSession,
} from '../core/security/pairingSession';

function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * 'locked' is the first state and there is no way around it: a pairing code can
 * add a device, so showing one needs a fresh proof of presence (biometrics, or
 * this wallet's passcode). An open app is not consent.
 */
type Phase = 'locked' | 'showing' | 'waiting' | 'expired' | 'confirm' | 'done';

export default function PairingCodeSheet({
  visible,
  onClose,
  onPaired,
}: {
  visible: boolean;
  onClose: () => void;
  /** Called after a device was paired, so the list can refresh. */
  onPaired?: () => void;
}) {
  const { theme } = useTheme();
  const [session, setSession] = useState<HostSession | null>(null);
  const [now, setNow] = useState(Date.now());
  const [phase, setPhase] = useState<Phase>('locked');
  const [joiner, setJoiner] = useState<{ pub: string; code: string } | null>(null);
  const [canBiometric, setCanBiometric] = useState(false);
  const [canPasscode, setCanPasscode] = useState(false);
  const [keypad, setKeypad] = useState(false);
  const [authNote, setAuthNote] = useState<string | null>(null);
  const cancelled = useRef(false);

  const mint = useCallback(async () => {
    cancelled.current = false;
    await ensureGroup();
    const s = await startPairingSession();
    setSession(s);
    setJoiner(null);
    setPhase('waiting');
    setNow(Date.now());
    // Wait for a joiner; ends on join, expiry or cancel.
    const result = await waitForJoiner();
    if (cancelled.current) return;
    if (result.status === 'joined') {
      setJoiner({ pub: result.joinerPub, code: result.safetyNumber });
      setPhase('confirm');
    } else if (result.status === 'expired') {
      setPhase('expired');
      setSession(null);
    } else if (result.status === 'cancelled') {
      setPhase('expired');
      setSession(null);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      // Locked until the owner proves it is them. Nothing is minted here.
      setPhase('locked');
      setAuthNote(null);
      pairingAuthOptions().then((o) => {
        setCanBiometric(o.biometric);
        setCanPasscode(o.passcode);
      });
    } else {
      cancelled.current = true;
      cancelPairingSession();
      setSession(null);
      setPhase('locked');
      setJoiner(null);
      setKeypad(false);
    }
    return () => {
      cancelled.current = true;
    };
  }, [visible, mint]);

  useEffect(() => {
    if (!visible || phase !== 'waiting') return;
    const t = setInterval(() => {
      const t0 = Date.now();
      setNow(t0);
      const live = currentPairingSession(t0);
      if (!live) {
        setPhase('expired');
        setSession(null);
      }
    }, 500);
    return () => clearInterval(t);
  }, [visible, phase]);

  const confirm = async () => {
    if (!joiner) return;
    const group = await getGroup();
    if (!group) return;
    const ok = await approveJoiner(joiner.pub, { groupId: group.groupId, key: group.key, epoch: group.epoch ?? 0 });
    if (ok) {
      setPhase('done');
      onPaired?.();
      setTimeout(() => onClose(), 1200);
    } else {
      setPhase('expired');
      setSession(null);
    }
  };

  const decline = async () => {
    await cancelPairingSession();
    setJoiner(null);
    setPhase('expired');
    setSession(null);
  };

  /** Ask for proof of presence, then mint. Never mints without it. */
  const unlockAndMint = async () => {
    setAuthNote(null);
    const outcome = await authenticateForPairing();
    if (outcome.ok) {
      // The session lives until the joiner arrives or it expires, so this is
      // kicked off rather than awaited: the sheet must stay responsive.
      mint();
      return;
    }
    if (outcome.passcodeAvailable) {
      setKeypad(true);
      return;
    }
    setAuthNote(
      outcome.reason === 'none'
        ? 'Set a passcode or biometrics first. A pairing code can add a device, so it needs one.'
        : 'Authentication is needed before a code is shown.',
    );
  };

  const remaining = session ? session.expiresAt - now : 0;
  const locked = phase === 'locked' || phase === 'showing';

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]} testID="pairingCodeSheet">
          <Text style={[styles.title, { color: theme.ink }]}>Pair a device</Text>
          <Text style={[styles.sub, { color: theme.inkMuted }]}>
            On the other device open Veltravia Wallet → Import an existing wallet → Pair device, then scan this code.
          </Text>

          <View style={styles.qrWrap}>
            {locked ? (
              <View style={styles.lockBox} testID="pairingLocked">
                <Text style={[styles.sub, { color: theme.inkMuted }]}>
                  Only show this code to someone you are pairing in person. Anyone who scans it can ask to join this
                  wallet group, so confirm it is you first.
                </Text>
                <Text style={[styles.fine, { color: theme.inkMuted }]}>
                  {canBiometric
                    ? 'Use your fingerprint or face to continue.'
                    : canPasscode
                      ? 'Enter your wallet passcode to continue.'
                      : 'No biometrics or passcode are set on this device, so a pairing code cannot be shown.'}
                </Text>
                {authNote ? (
                  <Text style={[styles.fine, { color: '#E5484D' }]} testID="pairingAuthNote">
                    {authNote}
                  </Text>
                ) : null}
              </View>
            ) : phase === 'confirm' && joiner ? (
              <View style={styles.confirmBox} testID="pairingConfirm">
                <Text style={[styles.sub, { color: theme.inkMuted }]}>
                  Check that the other device shows the same six digits. If it does not, tap Cancel — someone may be
                  intercepting the pairing.
                </Text>
                <Text style={[styles.safety, { color: theme.ink }]} testID="safetyNumber">
                  {joiner.code.slice(0, 3)} {joiner.code.slice(3)}
                </Text>
              </View>
            ) : session && phase !== 'expired' && phase !== 'done' ? (
              <>
                <QrCode value={session.uri} size={210} />
                <Text style={[styles.timer, { color: theme.inkMuted }]} testID="pairingTimer">
                  Expires in {mmss(remaining)}
                </Text>
              </>
            ) : (
              <Text style={[styles.sub, { color: theme.inkMuted }]} testID="pairingExpired">
                {phase === 'done' ? 'Device paired' : 'That code has expired.'}
              </Text>
            )}
          </View>

          <Text style={[styles.fine, { color: theme.inkMuted }]}>
            {phase === 'confirm'
              ? 'Nothing has been shared yet. Confirming sends this wallet’s lock key, encrypted for that device only.'
              : 'This code never contains your recovery phrase or any private key. It works once, and it expires on its own.'}
          </Text>

          <View style={styles.actions}>
            {locked ? (
              <>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [styles.btn, { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.8 : 1 }]}
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.btnText, { color: theme.ink }]}>Not now</Text>
                </Pressable>
                <Pressable
                  onPress={unlockAndMint}
                  disabled={!canBiometric && !canPasscode}
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: theme.brand, opacity: !canBiometric && !canPasscode ? 0.4 : pressed ? 0.85 : 1 },
                  ]}
                  accessibilityLabel={canBiometric ? 'Confirm it is you' : 'Enter passcode'}
                >
                  <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                    {canBiometric ? 'Confirm it’s you' : 'Enter passcode'}
                  </Text>
                </Pressable>
              </>
            ) : phase === 'confirm' ? (
              <>
                <Pressable
                  onPress={decline}
                  style={({ pressed }) => [styles.btn, { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.8 : 1 }]}
                  accessibilityLabel="Cancel pairing"
                >
                  <Text style={[styles.btnText, { color: theme.ink }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirm}
                  style={({ pressed }) => [styles.btn, { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 }]}
                  accessibilityLabel="Confirm the digits match"
                >
                  <Text style={[styles.btnText, { color: '#FFFFFF' }]}>They match</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => {
                    cancelPairingSession();
                    onClose();
                  }}
                  style={({ pressed }) => [styles.btn, { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.8 : 1 }]}
                  accessibilityLabel="Cancel pairing"
                >
                  <Text style={[styles.btnText, { color: theme.ink }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    // A new code is a new invitation: prove presence again.
                    cancelPairingSession();
                    setSession(null);
                    setJoiner(null);
                    setPhase('locked');
                  }}
                  style={({ pressed }) => [styles.btn, { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 }]}
                  accessibilityLabel="Show a new code"
                >
                  <Text style={[styles.btnText, { color: '#FFFFFF' }]}>New code</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>

      <PasscodeConfirmSheet
        visible={visible && keypad}
        title="Show pairing code"
        message="Enter your passcode to show a code that can add a device."
        onCancel={() => setKeypad(false)}
        onVerified={() => {
          setKeypad(false);
          mint();
        }}
      />
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 20, padding: 20, gap: 12 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  qrWrap: { alignItems: 'center', gap: 8, paddingVertical: 6, minHeight: 240, justifyContent: 'center' },
  confirmBox: { gap: 12, alignItems: 'center', paddingVertical: 8 },
  lockBox: { gap: 10, alignItems: 'center', paddingVertical: 8 },
  safety: { fontSize: 34, fontWeight: '800', letterSpacing: 6 },
  timer: { fontSize: 12.5 },
  fine: { fontSize: 11.5, lineHeight: 16, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  btn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
