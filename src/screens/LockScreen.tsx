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
 *   - 5 wrong attempts: 30s lockout, like Trust's fail counter
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, StatusBar, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { FingerprintIcon, BackspaceIcon, VeltraviaMark } from '../components/icons';
import { verifyPasscode } from '../core/storage/passcode';
import { isBiometricsSupported, isBiometricUnlockEnabled, promptBiometrics } from '../core/security/biometrics';

const LEN = 6;
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

  const press = useCallback(
    (k: string) => {
      if (busyRef.current || lockLeft > 0) return;
      if (k === 'del') {
        setValue((v) => v.slice(0, -1));
        setError('');
        return;
      }
      if (k === 'finger') {
        if (!bioOk || busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        promptBiometrics('Veltravia Wallet', 'Unlock your wallet')
          .then((ok) => {
            if (ok) unlock();
            else {
              busyRef.current = false;
              setBusy(false);
            }
          })
          .catch(() => {
            busyRef.current = false;
            setBusy(false);
          });
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
    [bioOk, complete, lockLeft, unlock],
  );

  const helper = lockLeft > 0
    ? `Too many attempts. Try again in ${Math.ceil(lockLeft / 1000)}s.`
    : 'Enter your passcode to unlock Veltravia.';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={styles.mark}>
        <VeltraviaMark size={40} />
      </View>

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
              <FingerprintIcon size={34} color={bioOk ? theme.brand : theme.inkMuted} />
            ) : k === 'del' ? (
              <BackspaceIcon size={30} color={theme.inkMuted} />
            ) : (
              <Text style={[styles.keyText, { color: theme.ink }]}>{k}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mark: { alignItems: 'center', paddingTop: 48 },
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
