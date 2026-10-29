/**
 * Veltravia AI — passcode confirmation for transfers.
 *
 * Fallback when biometrics are off, cancelled or fail. Same keypad language
 * as the lock screen: 6 dots, auto-verify on the last digit, shake + clear
 * on a wrong code, 5 wrong attempts => 30s lockout.
 *
 * This is VELTRAVIA'S OWN 6-digit passcode (com.veltravia.wallet.passcode),
 * never the device PIN/pattern: the device one is only ever requested by the
 * OS itself (biometrics.ts). Copy is passed in per job.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Vibration } from 'react-native';
import AppModal from '../../components/AppModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { BackspaceIcon, CloseIcon } from '../../components/icons';
import { verifyPasscode } from '../../core/storage/passcode';

const LEN = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;
const RED = '#E5484D';
const BLUE = '#4A90D9';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export default function PasscodeConfirmSheet({
  visible,
  onCancel,
  onVerified,
  title = 'Confirm transfer',
  message = 'Enter your passcode to approve this transfer.',
}: {
  visible: boolean;
  onCancel: () => void;
  onVerified: () => void;
  /** Copy for the job at hand (transfer, wallet lock, …). */
  title?: string;
  message?: string;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const [bad, setBad] = useState(false);
  const [ok, setOk] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockLeft, setLockLeft] = useState(0);
  const busy = useRef(false);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setValue(''); setBad(false); setOk(false);
    }
  }, [visible]);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const t = setInterval(() => setLockLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockLeft]);

  const press = async (k: string) => {
    if (busy.current || lockLeft > 0) return;
    if (k === 'del') { setValue((v) => v.slice(0, -1)); setBad(false); return; }
    if (!k || value.length >= LEN) return;
    Vibration.vibrate(8);
    const next = value + k;
    setValue(next);
    if (next.length < LEN) return;

    busy.current = true;
    const good = await verifyPasscode(next).catch(() => false);
    if (good) {
      setOk(true);
      setTimeout(() => { busy.current = false; onVerified(); }, 250);
      return;
    }
    Vibration.vibrate(120);
    setBad(true);
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start(() => {
      setValue(''); setBad(false); busy.current = false;
    });
    const n = attempts + 1;
    setAttempts(n);
    if (n >= MAX_ATTEMPTS) { setAttempts(0); setLockLeft(LOCKOUT_MS / 1000); }
  };

  if (!visible) return null;
  const dark = theme.mode === 'dark';
  const boxColor = ok ? BLUE : bad ? RED : theme.ink;

  return (
    <AppModal visible transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.scrim}>
        <View style={[styles.sheet, { backgroundColor: dark ? '#0B1220' : '#FFFFFF', paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.top}>
            <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
            <Pressable hitSlop={10} onPress={onCancel} style={[styles.x, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : '#EDEDF1' }]}>
              <CloseIcon size={20} color={theme.ink} />
            </Pressable>
          </View>
          <Text style={[styles.sub, { color: theme.inkMuted }]}>
            {lockLeft > 0 ? `Too many attempts. Try again in ${lockLeft}s.` : message}
          </Text>

          <Animated.View style={[styles.dots, { transform: [{ translateX: shake }] }]}>
            {Array.from({ length: LEN }).map((_, i) => (
              <View key={i} style={[styles.box, { borderColor: i < value.length || bad || ok ? boxColor : dark ? 'rgba(255,255,255,0.2)' : '#D5D5DD' }]}>
                {i < value.length && <View style={[styles.dot, { backgroundColor: boxColor }]} />}
              </View>
            ))}
          </Animated.View>

          <View style={styles.pad}>
            {KEYS.map((k, i) => (
              <Pressable
                key={i}
                disabled={!k}
                onPress={() => press(k)}
                style={({ pressed }) => [styles.key, { backgroundColor: pressed && k ? (dark ? 'rgba(255,255,255,0.10)' : '#EDEDF1') : 'transparent' }]}
              >
                {k === 'del' ? <BackspaceIcon size={26} color={theme.ink} /> : <Text style={[styles.keyText, { color: theme.ink }]}>{k}</Text>}
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 18 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontFamily: 'Inter-700', fontWeight: '700' },
  x: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sub: { fontSize: 14, marginTop: 8, fontFamily: 'Inter-500', fontWeight: '500' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 24 },
  box: { width: 44, height: 52, borderRadius: 12, borderWidth: 1.6, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  pad: { flexDirection: 'row', flexWrap: 'wrap' },
  key: { width: '33.33%', height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  keyText: { fontSize: 26, fontFamily: 'Inter-600', fontWeight: '600' },
});
