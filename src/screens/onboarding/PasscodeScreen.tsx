/**
 * Veltravia Wallet — Create / Confirm passcode (full-screen).
 *
 * Measured against the Trust capture: back arrow top-left, centred title,
 * six square boxes, helper text, 3x4 keypad (1-9, fingerprint, 0, delete).
 *
 *  - The 6th digit advances automatically (no submit button).
 *  - Confirm: when all six match, every box turns the brand blue, then
 *    `onDone(passcode)` fires. A mismatch shakes + clears + shows an error.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { BackIcon, FingerprintIcon, BackspaceIcon } from '../../components/icons';

const LEN = 6;
const KEYS: (string | 'finger' | 'del')[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'finger', '0', 'del'];
const BLUE = '#4A90D9'; // Veltravia brand blue (end of the purple-to-blue gradient)

export default function PasscodeScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  /** Called once the confirmed passcode is complete and matches. */
  onDone: (passcode: string) => void;
}) {
  const { theme } = useTheme();
  const [stage, setStage] = useState<'create' | 'confirm'>('create');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  const doShake = useCallback(() => {
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((to) =>
        Animated.timing(shake, { toValue: to, duration: 50, easing: Easing.linear, useNativeDriver: true }),
      ),
    ).start();
  }, [shake]);

  const complete = useCallback(
    (code: string) => {
      busy.current = true;
      if (stage === 'create') {
        // brief beat so the sixth box visibly fills before we advance
        setTimeout(() => {
          setFirst(code);
          setValue('');
          setStage('confirm');
          busy.current = false;
        }, 180);
      } else if (code === first) {
        setSuccess(true); // all six boxes go blue
        setTimeout(() => onDone(code), 450);
      } else {
        doShake();
        setError("Passcodes don't match. Try again.");
        setTimeout(() => {
          setValue('');
          busy.current = false;
        }, 350);
      }
    },
    [stage, first, onDone, doShake],
  );

  const press = useCallback(
    (k: string) => {
      if (busy.current) return;
      if (k === 'del') {
        setValue((v) => v.slice(0, -1));
        setError('');
        return;
      }
      if (k === 'finger') return; // biometrics unlock after a passcode exists
      setError('');
      setValue((v) => {
        if (v.length >= LEN) return v;
        const next = v + k;
        if (next.length === LEN) setTimeout(() => complete(next), 0);
        return next;
      });
    },
    [complete],
  );

  const goBack = useCallback(() => {
    if (stage === 'confirm') {
      setStage('create');
      setFirst('');
      setValue('');
      setError('');
    } else {
      onBack();
    }
  }, [stage, onBack]);

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
            const lit = success; // success -> every box blue
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  {
                    borderColor: lit ? BLUE : filled ? theme.brand : theme.border,
                    backgroundColor: lit ? BLUE : 'transparent',
                  },
                ]}
              >
                {filled && !lit && <View style={[styles.dot, { backgroundColor: theme.ink }]} />}
                {lit && <View style={[styles.dot, { backgroundColor: '#FFFFFF' }]} />}
              </View>
            );
          })}
        </Animated.View>

        <Text style={[styles.helper, { color: error ? '#E5484D' : theme.inkMuted }]}>{error || helper}</Text>
      </View>

      <View style={styles.pad}>
        {KEYS.map((k) => (
          <Pressable
            key={k}
            onPress={() => press(k)}
            disabled={k === 'finger'}
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
});
