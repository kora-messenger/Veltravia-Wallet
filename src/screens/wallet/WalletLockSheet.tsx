/**
 * Veltravia Wallet — Wallet Lock sheet (Settings).
 *
 * Rebuilt 31 Oct 2026 against Ijezie's reference: hero 3D shield, a blue status
 * card, a peach warning card, a separate recovery note, a violet-headed password
 * section, icon-led fields and one green gradient action button.
 *
 * Measurements came off the reference bitmap (683 px wide → 360 dp, so
 * 1 px ≈ 0.527 dp). Side margins 33 px ≈ 17 dp → 16. Card radius 33 px ≈ 17 →
 * 18. Field height, button height and type sizes were normalized UP to real
 * device sizes: the mock is drawn at ~0.53 of a phone, and a 36 dp button would
 * be unusable. Everything keeps the reference's proportions and hierarchy.
 *
 * The gate itself is unchanged:
 *   1. create your SECURITY PASSWORD (text password, separate from the
 *      6-digit passcode and biometrics) — one-time setup;
 *   2. lock / unlock the wallet: type the password, Approve, then confirm
 *      with biometrics (passcode sheet as fallback).
 *
 * While locked the wallet looks normal; sending and swapping are blocked
 * until it is unlocked again.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Animated,
  Easing,
  ScrollView,
  Platform,
  Keyboard,
  Image,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppModal from '../../components/AppModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import {
  CloseIcon,
  ShieldLockIcon,
  ShieldCheckIcon,
  CheckIcon,
  CheckCircleIcon,
  CheckRingIcon,
  LockSmallIcon,
  EyeIcon,
  EyeOffIcon,
  AlertCircleIcon,
} from '../../components/icons';
import { showToast } from '../../components/Toast';
import { promptBiometrics, isBiometricUnlockEnabled } from '../../core/security/biometrics';
import { hasSecurityPassword, setSecurityPassword, verifySecurityPassword } from '../../core/storage/securityPassword';
import { refreshWalletLock, setWalletLocked } from '../../core/security/walletLock';
import { publishLockState } from '../../core/security/lockRegistry';
import PasscodeConfirmSheet from '../ai/PasscodeConfirmSheet';
import { LockWarningCard, RecoveryNoteCard } from '../../components/LockWarning';
import { useWallets } from '../../wallets/WalletsProvider';

const MIN_LEN = 6;

/** Sampled from the reference screenshot. */
export const LOCK_PALETTE = {
  sheet: '#F3F2F6',
  ink: '#0C1030',
  muted: '#5D6280',
  // 4.58:1 on the white field (the mock's #8A8FAB is 3.18:1)
  faint: '#6F7492',
  fieldBg: '#FFFFFF',
  fieldBorder: '#E4E3EF',
  violet: '#5B4CFB',
  violetTint: 'rgba(91,76,251,0.10)',
  green: '#0E8A5F',
  greenBright: '#15B579',
  greenDeep: '#05784B',
  // darker than the mock's #2AB17C/#31B47F on purpose: white 15 sp on those is
  // only 3.3:1 and 2.6:1. These stops keep the same green→lighter-green ramp
  // at 5.35:1 and 4.64:1.
  gradient: ['#0A7A55', '#0C855D'] as const,
  statusGradient: ['#EDF3FE', '#E2EAFD'] as const,
  red: '#D63232',
  redGradient: ['#C42B2B', '#B92727'] as const,
  peach: '#FCE9D6',
  peachInk: '#7A3E12',
  amber: '#F85A03',
  handle: 'rgba(12,16,48,0.16)',
};

const SHIELD = require('../../../assets/brand/wallet-lock-shield.png');

/**
 * Module-level on purpose: defining this inside the sheet creates a new
 * component type every render, which remounts the field and drops focus
 * (the keyboard would open and instantly close).
 */
function Field(props: {
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
  err?: boolean;
  dark: boolean;
  focusColor: string;
  left: 'lock' | 'check';
  /** Filled green tick once the two passwords agree. */
  confirmed?: boolean;
  onSubmit?: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const p = LOCK_PALETTE;

  const borderColor = props.err
    ? p.red
    : focused
    ? props.focusColor
    : props.dark
    ? 'rgba(255,255,255,0.16)'
    : p.fieldBorder;

  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: props.dark ? 'rgba(255,255,255,0.06)' : p.fieldBg,
          borderColor,
          borderWidth: focused || props.err ? 1.6 : 1,
        },
      ]}
    >
      <View style={styles.fieldIcon}>
        {props.left === 'lock' ? (
          <LockSmallIcon size={18} color={props.dark ? '#A9AECB' : p.faint} />
        ) : props.confirmed ? (
          <CheckCircleIcon size={20} color={p.greenBright} />
        ) : (
          <CheckRingIcon size={20} color={props.dark ? '#7E83A0' : '#B4B6CC'} />
        )}
      </View>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        secureTextEntry={hidden}
        autoCorrect={false}
        autoCapitalize="none"
        autoComplete="off"
        placeholder={props.placeholder}
        placeholderTextColor={props.dark ? '#8E93B0' : p.faint}
        selectionColor={props.focusColor}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={props.onSubmit}
        accessibilityLabel={props.accessibilityLabel}
        testID={props.testID}
        style={[styles.fieldInput, { color: props.dark ? '#FFFFFF' : p.ink }]}
      />
      <Pressable
        hitSlop={12}
        onPress={() => setHidden((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
        testID={props.testID ? `${props.testID}Eye` : undefined}
        style={styles.eyeBtn}
      >
        {hidden ? (
          <EyeOffIcon size={19} color={props.dark ? '#A9AECB' : p.faint} />
        ) : (
          <EyeIcon size={19} color={props.dark ? '#A9AECB' : p.muted} />
        )}
      </Pressable>
    </View>
  );
}

export default function WalletLockSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const { activeWallet } = useWallets();
  const walletId = activeWallet.id;
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const p = LOCK_PALETTE;

  const [hasPw, setHasPw] = useState(true);
  const [locked, setLocked] = useState(false);

  // create-password step
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // lock/unlock step
  const [pw, setPw] = useState('');
  const [verifyErr, setVerifyErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passcodeStep, setPasscodeStep] = useState(false);

  // Edge-to-edge Android ignores adjustResize, so the keyboard would simply
  // overlay this sheet. Track its height and lift the sheet above it instead.
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, (e) => setKb(e.endCoordinates?.height ?? 0));
    const b = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  const shake = useState(new Animated.Value(0))[0];
  const doShake = () =>
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 40, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true, easing: Easing.linear }),
    ]).start();
  const shakeX = shake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] });

  const sync = async () => {
    setHasPw(await hasSecurityPassword(walletId).catch(() => false));
    setLocked(await refreshWalletLock(walletId).catch(() => false));
  };
  useEffect(() => {
    if (visible) {
      setPw1('');
      setPw2('');
      setCreateErr(null);
      setPw('');
      setVerifyErr(null);
      setCreating(false);
      setBusy(false);
      sync().catch(() => {});
    }
  }, [visible, walletId]);

  const createPassword = async () => {
    if (creating) return;
    if (pw1.length < MIN_LEN) return setCreateErr(`Use at least ${MIN_LEN} characters.`);
    if (pw1 !== pw2) return setCreateErr('Passwords do not match.');
    setCreateErr(null);
    setCreating(true);
    try {
      await setSecurityPassword(walletId, pw1);
      showToast('Security password set', { kind: 'success' });
      setHasPw(true);
    } catch {
      setCreateErr("Couldn't save that password. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const finish = async (lock: boolean) => {
    setBusy(true);
    await setWalletLocked(walletId, lock);
    await refreshWalletLock(walletId);
    // tell the registry, so a wallet recovered on another device knows at once
    await publishLockState(lock);
    setLocked(lock);
    setBusy(false);
    setPw('');
    showToast(lock ? 'Wallet locked' : 'Wallet unlocked', { kind: lock ? 'success' : 'info' });
  };

  const toggleLock = async () => {
    if (busy) return;
    const wantLock = !locked;
    if (!(await verifySecurityPassword(walletId, pw))) {
      setVerifyErr('Incorrect security password. Try again.');
      setPw('');
      doShake();
      return;
    }
    setVerifyErr(null);
    let ok = false;
    if (await isBiometricUnlockEnabled()) {
      ok = await promptBiometrics('Confirm wallet lock', wantLock ? 'Lock your wallet' : 'Unlock your wallet');
    }
    if (ok) {
      await finish(wantLock);
    } else {
      setPasscodeStep(true); // final verification: 6-digit passcode
    }
  };

  // ---- derived copy ------------------------------------------------------
  const statusText = locked ? 'Wallet is locked' : 'Wallet is unlocked';
  const statusBody = locked
    ? 'Sending and swapping are paused until you unlock your wallet.'
    : 'Lock to pause sending and swapping across this wallet.';
  const actionLabel = hasPw ? (locked ? 'Unlock wallet' : 'Lock wallet') : 'Set security password';
  const canAct = hasPw ? pw.length > 0 : pw1.length > 0 && pw2.length > 0;
  const submit = hasPw ? toggleLock : createPassword;
  const submitting = hasPw ? busy : creating;

  const focusColor = dark ? '#8B83FF' : p.violet;
  const sheetBg = dark ? '#0F1330' : p.sheet;

  return (
    <>
      <AppModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={[styles.scrim, { paddingBottom: kb }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss wallet lock" />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: sheetBg,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={styles.grabWrap}>
              <View style={[styles.grab, { backgroundColor: dark ? 'rgba(255,255,255,0.24)' : p.handle }]} />
            </View>

            {/* ---------- header: hero shield, title, close ---------- */}
            <View style={styles.headerRow}>
              <Image
                source={SHIELD}
                style={styles.heroShield}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
                accessible={false}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: dark ? '#FFFFFF' : p.ink }]} accessibilityRole="header">
                  Wallet Lock
                </Text>
                <Text style={[styles.walletSub, { color: dark ? '#A9AECB' : p.muted }]} testID="lockSheetSubtitle">
                  Veltravia Wallet
                </Text>
              </View>
              <Pressable
                hitSlop={12}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close wallet lock"
                testID="walletLockClose"
                style={[styles.closeBtn, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(12,16,48,0.06)' }]}
              >
                <CloseIcon size={18} color={dark ? '#E7E9F5' : p.ink} />
              </Pressable>
            </View>

            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={styles.scrollBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ---------- status ---------- */}
              <LinearGradient
                colors={dark ? ['rgba(91,76,251,0.18)', 'rgba(91,76,251,0.07)'] : (p.statusGradient as unknown as string[])}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statusCard, { borderColor: dark ? 'rgba(139,131,255,0.22)' : 'rgba(91,118,235,0.10)' }]}
              >
                <View style={styles.watermark} pointerEvents="none">
                  <ShieldCheckIcon size={118} color={dark ? '#8B83FF' : '#5B76EB'} strokeWidth={1.1} />
                </View>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: locked ? p.amber : p.greenBright },
                    ]}
                  >
                    {locked ? (
                      <LockSmallIcon size={17} color="#FFFFFF" strokeWidth={2.2} />
                    ) : (
                      <CheckIcon size={17} color="#FFFFFF" strokeWidth={2.8} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statusKicker, { color: dark ? '#B9BEE0' : '#404279' }]}>Status</Text>
                    <Text
                      style={[styles.statusText, { color: locked ? p.red : dark ? '#5FE0AE' : p.greenDeep }]}
                      testID="walletLockStatus"
                    >
                      {statusText}
                    </Text>
                    <Text style={[styles.statusBody, { color: dark ? '#AEB4D4' : p.muted }]}>{statusBody}</Text>
                  </View>
                </View>
              </LinearGradient>

              {/* ---------- warning + recovery note ---------- */}
              <View style={{ marginTop: 12, gap: 10 }}>
                <LockWarningCard />
                <RecoveryNoteCard />
              </View>

              {/* ---------- password section ---------- */}
              <View style={styles.sectionHead}>
                <View style={[styles.sectionIcon, { backgroundColor: dark ? 'rgba(139,131,255,0.16)' : p.violetTint }]}>
                  <ShieldLockIcon size={18} color={focusColor} />
                </View>
                <Text style={[styles.sectionTitle, { color: dark ? '#FFFFFF' : p.ink }]}>
                  {hasPw ? (locked ? 'Unlock your wallet' : 'Lock your wallet') : 'Create your security password'}
                </Text>
              </View>
              <Text style={[styles.sectionBody, { color: dark ? '#A9AECB' : p.muted }]}>
                {hasPw
                  ? 'Enter your security password to continue, then confirm with biometrics or your passcode.'
                  : "Use it to lock and unlock this wallet. Keep it private — it's separate from your passcode and biometrics."}
              </Text>

              <View style={{ marginTop: 12, gap: 10 }}>
                {!hasPw ? (
                  <>
                    <Field
                      value={pw1}
                      onChange={(t) => { setPw1(t); setCreateErr(null); }}
                      placeholder={`Password (min ${MIN_LEN} characters)`}
                      err={!!createErr}
                      dark={dark}
                      focusColor={focusColor}
                      left="lock"
                      accessibilityLabel="Security password"
                      testID="walletLockPassword"
                      onSubmit={createPassword}
                    />
                    <Field
                      value={pw2}
                      onChange={(t) => { setPw2(t); setCreateErr(null); }}
                      placeholder="Confirm password"
                      err={!!createErr}
                      dark={dark}
                      focusColor={focusColor}
                      left="check"
                      confirmed={pw2.length > 0 && pw2 === pw1}
                      accessibilityLabel="Confirm security password"
                      testID="walletLockConfirm"
                      onSubmit={createPassword}
                    />
                    {!!createErr && (
                      <View style={styles.errRow} testID="walletLockError">
                        <AlertCircleIcon size={14} color={p.red} />
                        <Text style={[styles.errText, { color: p.red }]}>{createErr}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
                    <Field
                      value={pw}
                      onChange={(t) => { setPw(t); setVerifyErr(null); }}
                      placeholder="Security password"
                      err={!!verifyErr}
                      dark={dark}
                      focusColor={focusColor}
                      left="lock"
                      accessibilityLabel="Security password"
                      testID="walletLockPassword"
                      onSubmit={toggleLock}
                    />
                  </Animated.View>
                )}
                {hasPw && !!verifyErr && (
                  <View style={styles.errRow} testID="walletLockError">
                    <AlertCircleIcon size={14} color={p.red} />
                    <Text style={[styles.errText, { color: p.red }]}>{verifyErr}</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* ---------- sticky action ---------- */}
            <View style={styles.footer}>
              <Pressable
                onPress={submit}
                disabled={!canAct || submitting}
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
                accessibilityState={{ disabled: !canAct || submitting, busy: submitting }}
                testID="walletLockAction"
                style={({ pressed }) => [
                  styles.btnShell,
                  { opacity: !canAct ? 0.45 : submitting ? 0.85 : pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.988 : 1 }] },
                ]}
              >
                <LinearGradient
                  colors={
                    (hasPw && !locked ? p.redGradient : p.gradient) as unknown as string[]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  <View style={styles.btnIcon}>
                    {submitting ? (
                      <ActivityIndicator size="small" color={p.gradient[0]} />
                    ) : hasPw && locked ? (
                      <ShieldLockIcon size={14} color={p.gradient[0]} strokeWidth={2.4} />
                    ) : hasPw ? (
                      <LockSmallIcon size={14} color={p.redGradient[0]} strokeWidth={2.4} />
                    ) : (
                      <CheckIcon size={14} color={p.gradient[0]} strokeWidth={3} />
                    )}
                  </View>
                  <Text style={styles.btnText} numberOfLines={1}>
                    {submitting ? (hasPw ? 'Working' : 'Setting password') : actionLabel}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </AppModal>

      <PasscodeConfirmSheet
        visible={passcodeStep}
        title="Confirm wallet lock"
        message="Enter your Veltravia passcode to confirm this wallet lock."
        onCancel={() => setPasscodeStep(false)}
        onVerified={async () => {
          setPasscodeStep(false);
          await finish(!locked);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,10,26,0.55)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '94%', paddingTop: 2 },
  grabWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  grab: { width: 36, height: 4, borderRadius: 2 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  heroShield: { width: 74, height: 59, marginLeft: -4 },
  title: { fontSize: 20, fontFamily: 'Inter-700', fontWeight: '700', letterSpacing: -0.3 },
  walletSub: { fontSize: 12.5, marginTop: 1, fontFamily: 'Inter-400', fontWeight: '400' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  scrollBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },

  statusCard: { borderRadius: 18, padding: 15, borderWidth: 1, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -22, top: -10, opacity: 0.09 },
  statusRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  statusBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  statusKicker: { fontSize: 11.5, fontFamily: 'Inter-600', fontWeight: '600', letterSpacing: 0.2 },
  statusText: { fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700', marginTop: 1 },
  statusBody: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter-400', fontWeight: '400', marginTop: 3 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700', letterSpacing: -0.2 },
  sectionBody: { fontSize: 12.5, lineHeight: 18.5, fontFamily: 'Inter-400', fontWeight: '400', marginTop: 8 },

  field: { flexDirection: 'row', alignItems: 'center', height: 54, borderRadius: 14, paddingHorizontal: 12 },
  fieldIcon: { width: 26, alignItems: 'flex-start', justifyContent: 'center' },
  fieldInput: { flex: 1, fontSize: 14.5, fontFamily: 'Inter-500', fontWeight: '500', paddingVertical: 0, height: '100%' },
  eyeBtn: { width: 30, height: 40, alignItems: 'center', justifyContent: 'center' },

  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  errText: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500', flex: 1 },

  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  btnShell: { borderRadius: 16, overflow: 'hidden' },
  btn: { height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  btnIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.1 },
});
