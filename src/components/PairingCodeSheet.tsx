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
import { View, Text, Pressable, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';
import GlowCorners, { GLOW_FROM, GLOW_TO } from './GlowCorners';
import { ChevronLeftIcon, PhoneIcon, ClockIcon } from './icons';
import { useTheme } from '../theme/ThemeProvider';
import QrCode from './QrCode';
import PairDeviceIntro from './PairDeviceIntro';
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
  // Safe when the host has no provider (modals, tests): fall back to a phone-ish inset.
  const insets = React.useContext(SafeAreaInsetsContext) ?? { top: 24, bottom: 16, left: 0, right: 0 };
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
  // Lavender for the feature bubbles and the notice; translucent violet on dark
  // so the card keeps the design's tint without glowing.
  const accent = theme.mode === 'light' ? '#F0F0FF' : 'rgba(108,99,255,0.14)';
  const accentText = theme.mode === 'light' ? '#4B3FD7' : '#A9A3FF';

  const QRF = 236;          // the code window, corners included
  const QR_RADIUS = 26;

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {locked ? (
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: theme.surface }]} testID="pairingCodeSheet">
            {/* Phases before a code exists: explain, then gate on proof of presence.
                Nothing is minted yet: explain what pairing does, then ask for proof
                of presence. "Show QR Code" goes through the same gate as before. */}
            <View testID="pairingLocked" style={{ flexShrink: 1 }}>
              {/* The card is tall on small phones: the explanation scrolls, the
                  two buttons stay put. */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ gap: 10 }}
              >
                <PairDeviceIntro
                  accent={accent}
                  accentText={accentText}
                  titleColor={theme.ink}
                  bodyColor={theme.inkMuted}
                />
              </ScrollView>
            </View>
            {authNote ? (
              <Text style={[styles.fine, { color: '#E5484D' }]} testID="pairingAuthNote">
                {authNote}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.btn, { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.8 : 1 }]}
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.btnText, { color: theme.ink }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={unlockAndMint}
                disabled={!canBiometric && !canPasscode}
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: theme.brand, opacity: !canBiometric && !canPasscode ? 0.4 : pressed ? 0.85 : 1 },
                ]}
                accessibilityLabel={canBiometric ? 'Show QR Code' : 'Enter passcode'}
              >
                <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                  {canBiometric ? 'Show QR Code' : 'Enter passcode'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        /* The QR screen itself: white ground, gradient headline, the code in a
           glowing window, the expiry pill, then the instruction card and Cancel.
           White in both themes, like the Restore Wallet screen. */
        <View style={styles.qrScreen} testID="pairingCodeSheet">
          <StatusBar barStyle="dark-content" />

          <View style={[styles.qrHeader, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={styles.iconBtn}>
              <ChevronLeftIcon size={22} color="#0B0B12" />
            </Pressable>
          </View>

          <View style={styles.qrHeadline} pointerEvents="none">
            <View style={styles.titleRow}>
              <Text style={styles.qrTitle}>Link </Text>
              <Svg width={92} height={36}>
                <Defs>
                  <SvgGradient id="linkWord" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={GLOW_FROM} />
                    <Stop offset="1" stopColor={GLOW_TO} />
                  </SvgGradient>
                </Defs>
                <SvgText x={0} y={27} fontSize={27} fontFamily="Inter-700" fontWeight="700" fill="url(#linkWord)">
                  Device
                </SvgText>
              </Svg>
            </View>
            <Text style={styles.qrSub}>
              On the other device open Veltravia Wallet → Import an existing wallet → Pair device, then scan this code.
            </Text>
          </View>

          <View style={styles.frameWrap}>
            <View style={{ width: QRF, height: QRF }}>
              <View style={styles.qrCard}>
                {phase === 'confirm' && joiner ? (
                  <View style={styles.confirmBox} testID="pairingConfirm">
                    <Text style={styles.confirmHint}>Check that the other device shows the same six digits</Text>
                    <Text style={styles.safety} testID="safetyNumber">
                      {joiner.code.slice(0, 3)} {joiner.code.slice(3)}
                    </Text>
                  </View>
                ) : session && phase !== 'expired' && phase !== 'done' ? (
                  <QrCode value={session.uri} size={QRF - 40} />
                ) : (
                  <Text style={styles.qrSub} testID="pairingExpired">
                    {phase === 'done' ? 'Device paired' : 'That code has expired.'}
                  </Text>
                )}
              </View>
              <Svg style={StyleSheet.absoluteFill} width={QRF} height={QRF} pointerEvents="none">
                <Defs>
                  <SvgGradient id="qrCorner" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={GLOW_FROM} />
                    <Stop offset="1" stopColor={GLOW_TO} />
                  </SvgGradient>
                </Defs>
                <GlowCorners x={0} y={0} size={QRF} radius={QR_RADIUS} arm={44} stroke="url(#qrCorner)" />
              </Svg>
            </View>

            {phase === 'confirm' || phase === 'expired' || phase === 'done' ? null : (
              <View style={styles.pill} testID="pairingTimer">
                <ClockIcon size={16} color="#0B0B12" />
                <Text style={styles.pillText}>Expires in {Math.max(0, Math.ceil(remaining / 1000))}s</Text>
              </View>
            )}

            <Text style={styles.qrFine}>
              {phase === 'confirm'
                ? 'Nothing has been shared yet. Confirming sends this wallet’s recovery phrase and lock key, sealed for that device only.'
                : 'This code contains no keys at all. It works once, expires on its own, and the wallet only moves after you approve these digits.'}
            </Text>
          </View>

          <View style={[styles.qrFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.infoBox}>
              <View style={styles.infoIcon}>
                <PhoneIcon size={20} color="#2EA2F8" />
              </View>
              <Text style={styles.infoText}>Make sure the QR code is clearly visible and within the frame.</Text>
            </View>

            <View style={styles.qrActions}>
              {phase === 'confirm' ? (
                <>
                  <Pressable
                    onPress={decline}
                    style={({ pressed }) => [styles.qrBtn, { opacity: pressed ? 0.8 : 1 }]}
                    accessibilityLabel="Cancel pairing"
                  >
                    <Text style={styles.qrBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={confirm}
                    style={({ pressed }) => [styles.qrBtn, styles.qrBtnPrimary, { opacity: pressed ? 0.85 : 1 }]}
                    accessibilityLabel="Confirm the digits match"
                  >
                    <Text style={[styles.qrBtnText, { color: '#FFFFFF' }]}>They match</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => {
                      cancelPairingSession();
                      onClose();
                    }}
                    style={({ pressed }) => [styles.qrBtn, { opacity: pressed ? 0.8 : 1 }]}
                    accessibilityLabel="Cancel pairing"
                  >
                    <Text style={styles.qrBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      // A new code is a new invitation: prove presence again.
                      cancelPairingSession();
                      setSession(null);
                      setJoiner(null);
                      setPhase('locked');
                    }}
                    style={({ pressed }) => [styles.qrBtn, styles.qrBtnPrimary, { opacity: pressed ? 0.85 : 1 }]}
                    accessibilityLabel="Show a new code"
                  >
                    <Text style={[styles.qrBtnText, { color: '#FFFFFF' }]}>New code</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      )}

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
  // locked gate (unchanged)
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 24, padding: 20, gap: 12, maxHeight: '92%' },
  fine: { fontSize: 11.5, lineHeight: 16, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  btn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },

  // the QR screen: white, like the restored reference
  qrScreen: { flex: 1, backgroundColor: '#FFFFFF' },
  qrHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 4 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F1F2F6',
    alignItems: 'center', justifyContent: 'center',
  },
  qrHeadline: { alignItems: 'center', paddingHorizontal: 18, paddingTop: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  qrTitle: {
    fontSize: 27, lineHeight: 36, color: '#0B0B12',
    fontFamily: 'Inter-700', fontWeight: '700', letterSpacing: -0.4,
  },
  qrSub: {
    marginTop: 8, paddingHorizontal: 14, textAlign: 'center',
    fontSize: 14, lineHeight: 20, color: '#6B6F7D', fontFamily: 'Inter-400',
  },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 14 },
  qrCard: {
    position: 'absolute', left: 14, top: 14, right: 14, bottom: 14,
    borderRadius: 18, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: 'rgba(11,14,26,0.07)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  confirmBox: { alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  confirmHint: { fontSize: 12, lineHeight: 16, textAlign: 'center', color: '#6B6F7D', fontFamily: 'Inter-400' },
  safety: { fontSize: 32, fontWeight: '800', letterSpacing: 5, color: '#0B0B12' },
  pill: {
    height: 38, borderRadius: 19, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F4F5F9', borderWidth: 1, borderColor: 'rgba(11,14,26,0.07)',
  },
  pillText: { color: '#0B0B12', fontSize: 14, fontFamily: 'Inter-500' },
  qrFine: {
    fontSize: 12, lineHeight: 17, textAlign: 'center',
    color: '#6B6F7D', fontFamily: 'Inter-400', paddingHorizontal: 20,
  },
  qrFooter: { paddingHorizontal: 16, paddingTop: 6 },
  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F4F5F9', borderRadius: 16, padding: 14, marginBottom: 12,
  },
  infoIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(46,162,248,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoText: { flex: 1, color: '#4A4E5A', fontSize: 13, lineHeight: 18, fontFamily: 'Inter-400' },
  qrActions: { flexDirection: 'row', gap: 10 },
  qrBtn: {
    flex: 1, height: 52, borderRadius: 26,
    backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center',
  },
  qrBtnPrimary: { backgroundColor: '#6C63FF' },
  qrBtnText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', color: '#0B0B12' },
});
