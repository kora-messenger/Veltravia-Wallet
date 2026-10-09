/**
 * Veltravia Wallet — Create / Confirm passcode (full-screen).
 *
 * Spec locked with Ijezie (Oct 10 2026):
 *  - Each digit tapped: a dot fills the box + a short vibration.
 *  - 6th digit advances automatically (no submit button).
 *  - Confirm + match: the box AND the dot turn brand blue.
 *  - Confirm + mismatch: the full box including the dot turns red,
 *    shakes and vibrates at the same time, then clears straight back
 *    to empty.
 *  - After the blue state: the "Biometric Login" popup appears.
 *      * Deny  -> biometrics skipped, flow continues.
 *      * Confirm -> splash flash, then the OS fingerprint/face prompt.
 *          - cancel -> back on the Confirm screen, digits still filled;
 *            delete the last digit, retype it -> blue -> popup again.
 *          - success -> flow continues.
 *  - Back arrow: confirm -> create -> welcome.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, StatusBar, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../theme/ThemeProvider';
import { BackIcon, FingerprintIcon, BackspaceIcon, VeltraviaMark } from '../../components/icons';
import BiometricLoginSheet from '../../components/BiometricLoginSheet';
import { isBiometricsSupported, promptBiometrics } from '../../core/security/biometrics';

const LEN = 6;
const KEYS: (string | 'finger' | 'del')[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'finger', '0', 'del'];
const BLUE = '#4A90D9'; // Veltravia brand blue (end of the gradient)
const RED = '#E5484D';

type BiometricOutcome = 'allowed' | 'denied';

export default function PasscodeScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  /** Called once the passcode is confirmed AND the biometric step is settled. */
  onDone: (passcode: string, biometric: BiometricOutcome) => void;
}) {
  const { theme } = useTheme();
  const [stage, setStage] = useState<'create' | 'confirm'>('create');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [bioSheet, setBioSheet] = useState(false);
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const busyRef = useRef(false);
  const valueRef = useRef('');
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const doShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((to) =>
        Animated.timing(shake, { toValue: to, duration: 50, easing: Easing.linear, useNativeDriver: true }),
      ),
    ).start();
  }, [shake]);

  /** After the blue state on the confirm stage: open the Biometric Login popup. */
  const complete = useCallback(
    (code: string) => {
      busyRef.current = true;
      setBusy(true);
      if (stage === 'create') {
        // brief beat so the sixth box visibly fills before we advance
        setTimeout(() => {
          setFirst(code);
          setValue('');
          setStage('confirm');
          busyRef.current = false;
          setBusy(false);
        }, 180);
      } else if (code === first) {
        setSuccess(true); // box + dot turn blue
        setTimeout(() => {
          setBioSheet(true); // popup comes after the blue boxes
        }, 550);
      } else {
        // mismatch: red + shake + vibrate all at the same time
        setMismatch(true);
        Vibration.vibrate(80);
        doShake();
        setError("Passcodes don't match. Try again.");
        setTimeout(() => {
          setValue(''); // clear straight back to empty
          setMismatch(false);
          busyRef.current = false;
          setBusy(false);
        }, 480);
      }
    },
    [stage, first, doShake],
  );

  const finishFromBiometric = useCallback(
    (outcome: BiometricOutcome) => {
      setBioSheet(false);
      const code = value;
      setTimeout(() => onDone(code, outcome), 150);
    },
    [value, onDone],
  );

  /** Confirm on the Biometric Login popup: splash flash -> OS prompt. */
  const onBioConfirm = useCallback(async () => {
    setBioSheet(false);
    const supported = await isBiometricsSupported();
    if (!supported) {
      finishFromBiometric('allowed');
      return;
    }
    setFlash(true); // "flashy" splash open, like Trust
    setTimeout(async () => {
      const ok = await promptBiometrics('Veltravia Wallet', 'Confirm your identity');
      setFlash(false);
      if (ok) {
        finishFromBiometric('allowed');
      } else {
        // cancelled: back on the Confirm screen, digits still written.
        // Success state off; user deletes the last digit and retypes it.
        setSuccess(false);
        busyRef.current = false;
        setBusy(false);
      }
    }, 550);
  }, [finishFromBiometric]);

  const press = useCallback(
    (k: string) => {
      if (busyRef.current) return;
      if (k === 'del') {
        setValue((v) => v.slice(0, -1));
        setError('');
        return;
      }
      if (k === 'finger') return; // unlock with biometrics comes later
      if (valueRef.current.length >= LEN) return;
      setError('');
      Vibration.vibrate(9); // the box is "vibrant" on every tap
      const next = valueRef.current + k;
      setValue(next);
      if (next.length === LEN) setTimeout(() => complete(next), 120);
    },
    [complete],
  );

  const goBack = useCallback(() => {
    if (bioSheet || flash) return;
    if (stage === 'confirm') {
      setStage('create');
      setFirst('');
      setValue('');
      setSuccess(false);
      setError('');
    } else {
      onBack();
    }
  }, [stage, bioSheet, flash, onBack]);

  // Android hardware back follows the same path.
  useEffect(() => {
    const { BackHandler } = require('react-native');
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack]);

  const title = stage === 'create' ? 'Create passcode' : 'Confirm passcode';
  const helper =
    stage === 'create'
      ? 'Enter your passcode. Be sure to remember it so you can unlock your wallet.'
      : 'Re-enter your passcode. Be sure to remember it so you can unlock your wallet.';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <Pressable hitSlop={14} onPress={goBack} style={styles.back}>
        <BackIcon size={24} color={theme.ink} />
      </Pressable>

      <View style={styles.top}>
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>

        <Animated.View style={[styles.boxes, { transform: [{ translateX: shake }] }]}>
          {Array.from({ length: LEN }).map((_, i) => {
            const filled = i < value.length;
            const boxColor = mismatch ? RED : success ? BLUE : filled ? theme.brand : theme.border;
            const dotColor = mismatch ? RED : success ? BLUE : theme.ink;
            return (
              <View
                key={i}
                style={[styles.box, { borderColor: boxColor, backgroundColor: 'transparent' }]}
              >
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
            disabled={k === 'finger' || busy}
            style={({ pressed }) => [styles.key, { opacity: pressed ? 0.45 : 1 }]}
            android_ripple={{ color: theme.border, borderless: true, radius: 40 }}
          >
            {k === 'finger' ? (
              <FingerprintIcon size={34} color={theme.inkMuted} />
            ) : k === 'del' ? (
              <BackspaceIcon size={30} color={theme.inkMuted} />
            ) : (
              <Text style={[styles.keyText, { color: theme.ink }]}>{k}</Text>
            )}
          </Pressable>
        ))}
      </View>

      <BiometricLoginSheet visible={bioSheet} onDeny={() => finishFromBiometric('denied')} onConfirm={onBioConfirm} />

      {/* Splash flash while the OS biometric prompt opens */}
      {flash && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            colors={['#6C63FF', BLUE]}
            style={styles.flash}
          >
            <VeltraviaMark size={72} />
          </LinearGradient>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  back: { position: 'absolute', top: 48, left: 20, zIndex: 5, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  top: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  title: { fontFamily: 'Inter-600', fontSize: 18, lineHeight: 24, marginBottom: 28 },
  boxes: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  box: { width: 48, height: 52, borderRadius: 6, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  helper: { fontFamily: 'Inter-500', fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 36, paddingBottom: 24 },
  key: { width: '33.333%', height: 76, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: 'Inter-600', fontSize: 30, lineHeight: 36 },
  flash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
