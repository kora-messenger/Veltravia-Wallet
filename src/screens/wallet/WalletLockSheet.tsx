/**
 * Veltravia Wallet — Wallet Lock sheet (Settings).
 *
 * Same gate as the AI flow, in one place:
 *   1. create your SECURITY PASSWORD (text password, separate from the
 *      6-digit passcode and biometrics) — one-time setup;
 *   2. lock / unlock the wallet: type the password, Approve, then confirm
 *      with biometrics (passcode sheet as fallback).
 *
 * While locked the wallet looks normal; sending and swapping are blocked
 * until it is unlocked again.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Animated, Easing, ScrollView, Platform, Keyboard } from 'react-native';
import AppModal from '../../components/AppModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { CloseIcon, ShieldLockIcon, CheckIcon } from '../../components/icons';
import { showToast } from '../../components/Toast';
import { promptBiometrics, isBiometricUnlockEnabled } from '../../core/security/biometrics';
import { hasSecurityPassword, setSecurityPassword, verifySecurityPassword } from '../../core/storage/securityPassword';
import { walletLocked, refreshWalletLock, setWalletLocked } from '../../core/security/walletLock';
import { publishLockState } from '../../core/security/lockRegistry';
import PasscodeConfirmSheet from '../ai/PasscodeConfirmSheet';
import LockWarning from '../../components/LockWarning';
import { useWallets } from '../../wallets/WalletsProvider';

const GREEN = '#12915E';
const RED = '#E5484D';
const MIN_LEN = 6;


/** Module-level on purpose: defining this inside the sheet creates a new
 *  component type every render, which remounts the field and drops focus
 *  (the keyboard would open and instantly close). */
function Input(props: {
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
  err?: boolean;
  fieldBg: string;
  ink: string;
  muted: string;
  brand: string;
}) {
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChange}
      secureTextEntry
      autoCorrect={false}
      autoCapitalize="none"
      placeholder={props.placeholder}
      placeholderTextColor={props.muted}
      selectionColor={props.brand}
      style={[styles.input, { backgroundColor: props.fieldBg, color: props.ink, borderColor: props.err ? RED : 'transparent' }]}
    />
  );
}

export default function WalletLockSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const { activeWallet } = useWallets();
  const walletId = activeWallet.id;
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();

  const [hasPw, setHasPw] = useState(true);
  const [locked, setLocked] = useState(false);

  // create-password step
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [createErr, setCreateErr] = useState<string | null>(null);

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
    return () => { a.remove(); b.remove(); };
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
      setPw1(''); setPw2(''); setCreateErr(null); setPw(''); setVerifyErr(null);
      sync().catch(() => {});
    }
  }, [visible, walletId]);

  const createPassword = async () => {
    if (pw1.length < MIN_LEN) return setCreateErr(`Use at least ${MIN_LEN} characters.`);
    if (pw1 !== pw2) return setCreateErr('Passwords do not match.');
    await setSecurityPassword(walletId, pw1);
    showToast('Security password set', { kind: 'success' });
    setHasPw(true);
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

  const panel = dark ? 'rgba(255,255,255,0.07)' : '#F1F1F5';
  const fieldBg = dark ? 'rgba(255,255,255,0.10)' : '#FFFFFF';
  const fieldProps = { fieldBg, ink: theme.ink, muted: theme.inkMuted, brand: theme.brand };


  return (
    <>
      <AppModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={[styles.scrim, { backgroundColor: 'rgba(0,0,0,0.45)', paddingBottom: kb }]}>
          <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.grabWrap}>
              <View style={[styles.grab, { backgroundColor: dark ? 'rgba(255,255,255,0.25)' : 'rgba(6,14,44,0.15)' }]} />
            </View>

            <View style={styles.headerRow}>
              <View style={[styles.iconWrap, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : '#F1F1F5' }]}>
                <ShieldLockIcon size={24} color={theme.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.ink }]}>Wallet Lock</Text>
                <Text style={[styles.walletSub, { color: theme.inkMuted }]}>{activeWallet.name}</Text>
              </View>
              <Pressable hitSlop={10} onPress={onClose} style={[styles.closeBtn, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : '#F1F1F5' }]}>
                <CloseIcon size={20} color={theme.ink} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 10 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.statusCard, { backgroundColor: panel }]}>
                <Text style={[styles.statusKicker, { color: theme.inkMuted }]}>STATUS</Text>
                <Text style={[styles.statusText, { color: locked ? RED : GREEN }]}>
                  {locked ? 'Wallet is locked' : 'Wallet is unlocked'}
                </Text>
                <Text style={[styles.statusBody, { color: theme.inkMuted }]}>
                  {locked
                    ? 'Sending and swapping are paused until you unlock your wallet.'
                    : 'Lock to pause sending and swapping across this wallet.'}
                </Text>
              </View>

              <View style={{ marginHorizontal: 20, marginTop: 12 }}>
                <LockWarning />
              </View>

              {!hasPw ? (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.ink }]}>Create your security password</Text>
                  <Text style={[styles.sectionBody, { color: theme.inkMuted }]}>
                    Use it to lock and unlock this wallet. Keep it private — it's separate from your passcode and
                    biometrics.
                  </Text>
                  <Input value={pw1} onChange={setPw1} placeholder={`Password (min ${MIN_LEN} characters)`} err={!!createErr} {...fieldProps} />
                  <Input value={pw2} onChange={setPw2} placeholder="Confirm password" err={!!createErr} {...fieldProps} />
                  {!!createErr && <Text style={styles.errText}>{createErr}</Text>}
                  <Pressable
                    onPress={createPassword}
                    disabled={pw1.length === 0 || pw2.length === 0}
                    style={({ pressed }) => [styles.btn, { backgroundColor: GREEN, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <CheckIcon size={18} color="#fff" />
                    <Text style={[styles.btnText, { color: '#fff' }]}>Set security password</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.ink }]}>
                    {locked ? 'Unlock your wallet' : 'Lock your wallet'}
                  </Text>
                  <Text style={[styles.sectionBody, { color: theme.inkMuted }]}>
                    Enter your security password to continue, then confirm with biometrics or your passcode.
                  </Text>
                  <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
                    <Input value={pw} onChange={setPw} placeholder="Security password" err={!!verifyErr} {...fieldProps} />
                  </Animated.View>
                  {!!verifyErr && <Text style={styles.errText}>{verifyErr}</Text>}
                  <Pressable
                    onPress={toggleLock}
                    disabled={busy || pw.length === 0}
                    style={({ pressed }) => [
                      styles.btn,
                      { backgroundColor: locked ? GREEN : RED, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
                    ]}
                  >
                    <ShieldLockIcon size={18} color="#fff" />
                    <Text style={[styles.btnText, { color: '#fff' }]}>{locked ? 'Unlock wallet' : 'Lock wallet'}</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
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
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' },
  grabWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  grab: { width: 40, height: 4, borderRadius: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 19, fontFamily: 'Inter-700', fontWeight: '700' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statusCard: { borderRadius: 16, padding: 16, marginHorizontal: 20, gap: 4 },
  statusKicker: { fontSize: 10, fontFamily: 'Inter-600', fontWeight: '600', letterSpacing: 1 },
  statusText: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
  statusBody: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter-400', fontWeight: '400', marginTop: 2 },
  section: { paddingHorizontal: 20, paddingTop: 18, gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  sectionBody: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter-400', fontWeight: '400' },
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
  btn: { height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  walletSub: { fontSize: 12, marginTop: 1, fontFamily: 'Inter-400', fontWeight: '400' },
});
