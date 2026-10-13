/**
 * Veltravia Wallet — Lock screen (unlock with passcode).
 *
 * Mirrors Trust: once a passcode is confirmed during onboarding, every
 * cold start / return from background lands here instead of the welcome
 * screen. Same keypad language as the onboarding passcode screens:
 *   - digit tap: dot fills the box + short vibration
 *   - 6th digit: auto-verifies (no submit button)
 *   - match: box + dot turn brand blue, then the app unlocks
 *   - wrong: full box incl. dot turns red, shakes + vibrates, clears
 *   - biometric key unlocks with the OS prompt when enabled
 *   - the OS biometric prompt AUTO-presents when this screen appears and
 *     again on every return from the background (Trust parity); after a
 *     cancel it stays down until the fingerprint key re-triggers it
 *   - 5 wrong attempts: 30s lockout, like Trust's fail counter
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, StatusBar, Vibration, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import BiometricSplash from '../components/BiometricSplash';
import { FingerprintIcon, BackspaceIcon, ScanFaceIcon } from '../components/icons';
import { verifyPasscode } from '../core/storage/passcode';
import { isBiometricsSupported, isBiometricUnlockEnabled, promptBiometrics, getBiometryType, type BiometryType } from '../core/security/biometrics';

const LEN = 6;
const jsStartedAt = Date.now(); // set at module load (~process start): cold-start detect

const KEYS: (string | 'finger' | 'del')[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'finger', '0', 'del'];
const BLUE = '#4A90D9';
const RED = '#E5484D';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { theme } = useTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [bioType, setBioType] = useState<BiometryType>('none');
  const [splash, setSplash] = useState(false); // gradient + V while the OS prompt is up
  const cancelledRef = useRef(false);
  const [attempts, setAttempts] = useState(0);
  const [lockLeft, setLockLeft] = useState(0);
  const shake = useRef(new Animated.Value(0)).current;
  const busyRef = useRef(false);
  const valueRef = useRef('');
  const unlockedRef = useRef(false);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Is the fingerprint key usable at all?
  useEffect(() => {
    (async () => {
      if (await isBiometricsSupported()) {
        setBioType(await getBiometryType());
        setBioOk(await isBiometricUnlockEnabled());
      }
    })().catch(() => {});
  }, []);

  // Lockout countdown.
  useEffect(() => {
    if (lockLeft <= 0) return;
    const t = setInterval(() => setLockLeft((s) => Math.max(0, s - 1000)), 1000);
    return () => clearInterval(t);
  }, [lockLeft]);

  const doShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((to) =>
        Animated.timing(shake, { toValue: to, duration: 50, easing: Easing.linear, useNativeDriver: true }),
      ),
    ).start();
  }, [shake]);

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    setTimeout(onUnlock, 350); // brief beat on the blue state, like onboarding
  }, [onUnlock]);

  const complete = useCallback(
    async (code: string) => {
      const ok = await verifyPasscode(code);
      if (ok) {
        setSuccess(true); // box + dot turn blue
        unlock();
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setMismatch(true);
        Vibration.vibrate(80);
        doShake();
        if (next >= MAX_ATTEMPTS) {
          setError('Too many attempts. Try again in 30s.');
          setValue('');
          setLockLeft(LOCKOUT_MS);
          setTimeout(() => {
            setMismatch(false);
            setAttempts(0);
            busyRef.current = false;
            setBusy(false);
          }, 480);
        } else {
          setError('Wrong passcode. Try again.');
          setTimeout(() => {
            setValue('');
            setMismatch(false);
            busyRef.current = false;
            setBusy(false);
          }, 480);
        }
      }
    },
    [attempts, doShake, unlock],
  );

  /* ---- Trust-parity biometric presentation ----
   * Trust presents the system prompt automatically when the lock screen
   * shows (cold start / background return) and re-presents on every return
   * to the foreground. A canceled prompt stays down until the user taps
   * the fingerprint key again. Never fires while app is backgrounded
   * (Android refuses prompts from the background) or during a lockout.
   */
  const presentBio = useCallback(() => {
    if (!bioOk || busyRef.current || unlockedRef.current) return;
    if (lockLeft > 0) return;
    if (AppState.currentState !== 'active') return;
    busyRef.current = true;
    cancelledRef.current = false;
    setBusy(true);
    setSplash(true); // Trust opens its biometric screen: gradient + brand V
    promptBiometrics('Veltravia Wallet', 'Unlock your wallet')
      .then((ok) => {
        if (ok && !cancelledRef.current) {
          unlock(); // splash stays up through the unlock beat
        } else {
          setSplash(false);
          busyRef.current = false;
          setBusy(false);
        }
      })
      .catch(() => {
        setSplash(false);
        busyRef.current = false;
        setBusy(false);
      });
  }, [bioOk, lockLeft, unlock]);


  // Auto-present once per mount when biometric unlock is on. On a cold
  // start the native launch splash is still held/fading behind us, so wait
  // for it to be gone; on later mounts (background returns) it's fast.
  useEffect(() => {
    if (!bioOk) return;
    const coldStart = Date.now() - jsStartedAt < 2500;
    const t = setTimeout(() => presentBio(), coldStart ? 2600 : 400);
    return () => clearTimeout(t);
  }, [bioOk]);

  // Re-present when the app returns to the foreground while still locked.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') setTimeout(() => presentBio(), 150);
    });
    return () => sub.remove();
  }, [presentBio]);

  const press = useCallback(
    (k: string) => {
      if (busyRef.current || lockLeft > 0) return;
      if (k === 'del') {
        setValue((v) => v.slice(0, -1));
        setError('');
        return;
      }
      if (k === 'finger') {
        presentBio();
        return;
      }
      if (valueRef.current.length >= LEN) return;
      setError('');
      Vibration.vibrate(9);
      const next = valueRef.current + k;
      setValue(next);
      if (next.length === LEN) {
        busyRef.current = true;
        setBusy(true);
        setTimeout(() => complete(next), 120);
      }
    },
    [complete, lockLeft, presentBio],
  );

  const helper = lockLeft > 0
    ? `Too many attempts. Try again in ${Math.ceil(lockLeft / 1000)}s.`
    : 'Enter your passcode to unlock Veltravia.';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={styles.top}>
        <Text style={[styles.title, { color: theme.ink }]}>Enter passcode</Text>

        <Animated.View style={[styles.boxes, { transform: [{ translateX: shake }] }]}>
          {Array.from({ length: LEN }).map((_, i) => {
            const filled = i < value.length;
            const boxColor = mismatch ? RED : success ? BLUE : filled ? theme.brand : theme.border;
            const dotColor = mismatch ? RED : success ? BLUE : theme.ink;
            return (
              <View key={i} style={[styles.box, { borderColor: boxColor, backgroundColor: 'transparent' }]}>
                {filled && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
              </View>
            );
          })}
        </Animated.View>

        <Text style={[styles.helper, { color: error ? RED : theme.inkMuted }]}>{error || helper}</Text>
      </View>

      <View style={styles.pad}>
        {KEYS.map((k) => (
          <Pressable
            key={k}
            onPress={() => press(k)}
            disabled={(k === 'finger' && !bioOk) || busy || lockLeft > 0}
            style={({ pressed }) => [styles.key, { opacity: pressed ? 0.45 : 1 }]}
            android_ripple={{ color: theme.border, borderless: true, radius: 40 }}
          >
            {k === 'finger' ? (
              bioType === 'faceId' ? (
                <ScanFaceIcon size={30} color={bioOk ? theme.brand : theme.inkMuted} />
              ) : (
                <FingerprintIcon size={34} color={bioOk ? theme.brand : theme.inkMuted} />
              )
            ) : k === 'del' ? (
              <BackspaceIcon size={30} color={theme.inkMuted} />
            ) : (
              <Text style={[styles.keyText, { color: theme.ink }]}>{k}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
    {splash && <BiometricSplash />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  title: { fontFamily: 'Inter-600', fontSize: 18, lineHeight: 24, marginBottom: 28 },
  boxes: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  box: { width: 48, height: 52, borderRadius: 6, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  helper: { fontFamily: 'Inter-500', fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 36, paddingBottom: 24 },
  key: { width: '33.333%', height: 76, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: 'Inter-600', fontSize: 30, lineHeight: 36 },
});
