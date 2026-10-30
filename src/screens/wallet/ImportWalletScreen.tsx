/**
 * Veltravia Wallet — "Restore Wallet" (secret phrase entry).
 *
 * Rebuilt to the reference screen, on white: the 3D wallet art, the headline
 * with "Wallet" in the brand gradient, a short subtitle, a bordered "Secret
 * phrase" card holding the input and its eye toggle, a "Keep your phrase safe"
 * card, a full-width Paste row, and the gradient Continue.
 *
 * This screen is intentionally light in both themes — the reference is a white
 * sheet, so it does not follow the dark palette.
 *
 * The phrase is never logged and only reaches the keystore on a valid Continue,
 * where it must pass wordlist membership AND the BIP-39 checksum.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  StatusBar,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';
import {
  BackIcon, ScanIcon, DocIcon, ShieldCheckIcon, EyeIcon, EyeOffIcon, ChevronRightIcon, CopyIcon,
} from '../../components/icons';
import { normalizeMnemonic, validateMnemonic } from '../../core/wallet/bip39';
import { walletManager } from '../../core/wallet/walletManager';
import { pasteFromClipboard } from '../../core/clipboard';
import { useWallets } from '../../wallets/WalletsProvider';
import { registerScanTarget } from '../../services/scanTarget';
import { parsePairingCode } from '../../core/security/pairingSession';

/** Fixed light palette: the reference screen is a white sheet. */
const C = {
  bg: '#FFFFFF',
  ink: '#0B0B12',
  muted: '#7D7D85',
  border: '#EAEAF0',
  field: '#FAFAFC',
  tint: '#F4F3FF',
  brand: '#6C63FF',
};

/** Keep the word count and spacing, lose the words themselves. */
function maskPhrase(phrase: string): string {
  return phrase.replace(/[^\s]+/g, (word) => '•'.repeat(Math.max(4, Math.min(10, word.length))));
}

export default function ImportWalletScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const { nextWalletName, createWallet } = useWallets();

  const [phrase, setPhrase] = useState('');
  const [hidden, setHidden] = useState(false);
  const [checking, setChecking] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);

  const check = validateMnemonic(phrase);
  const valid = check.ok;
  const hasText = phrase.trim().length > 0;

  // The scanner icon breathes, so it reads as "this opens the camera".
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scanStyle = {
    transform: [
      { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
      { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] }) },
    ],
  };

  const onPaste = async () => {
    const pasted = await pasteFromClipboard();
    if (!pasted) return;
    setPhrase(pasted);
    setHidden(false);
    if (storeError) setStoreError(null);
  };

  const onClear = () => {
    setPhrase('');
    setHidden(false);
    if (storeError) setStoreError(null);
  };

  const onScan = () => {
    // This scanner has two jobs on one screen: read a secret phrase into the box,
    // or read another device's pairing code and hand it to the pairing flow.
    const off = registerScanTarget(
      (value: string) => {
        off();
        const pairing = parsePairingCode(value);
        if (pairing.ok) {
          navigation.navigate('PairVerify', { uri: value });
          return;
        }
        setPhrase(normalizeMnemonic(value));
        setHidden(false);
        if (storeError) setStoreError(null);
      },
      undefined,
      {
        title: 'Scan QR code',
        hint: 'A secret phrase, or a pairing code from another device',
        accept: (value) => {
          if (validateMnemonic(value).ok) {
            return { ok: true as const, value: normalizeMnemonic(value) };
          }
          if (parsePairingCode(value).ok) {
            return { ok: true as const, value };
          }
          return {
            ok: false as const,
            reason: "That QR code isn't a secret phrase or a pairing code.",
          };
        },
      },
    );
    navigation.navigate('ScanQr');
  };

  const restore = async () => {
    if (!valid || checking) return;
    setChecking(true);
    const stored = await walletManager.importWallet(phrase);
    setChecking(false);
    if (!stored) {
      setStoreError('That phrase could not be stored on this device. Try again.');
      return;
    }
    createWallet(nextWalletName(), 'default', 'violet', 'imported');
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const words = normalizeMnemonic(phrase).split(' ').filter(Boolean);
  const problem =
    !valid && words.length >= 3 && !hidden
      ? check.ok === false && check.reason === 'count'
        ? 'A secret phrase is 12, 15, 18, 21 or 24 words.'
        : check.ok === false && check.reason === 'unknown-word'
          ? 'One of those words is not in the secret-phrase list.'
          : check.ok === false && check.reason === 'checksum'
            ? "That phrase doesn't add up. Check the words and their order."
            : null
      : null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()} style={styles.headerBtn} testID="restoreBack">
          <BackIcon size={24} color={C.ink} />
        </Pressable>
        <Pressable hitSlop={12} onPress={onScan} style={styles.headerBtn} testID="restoreScan">
          <Animated.View style={scanStyle}>
            <ScanIcon size={22} color={C.ink} />
          </Animated.View>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require('../../assets/restore-wallet-3d.png')}
          style={styles.art}
          resizeMode="contain"
        />

        <View style={styles.titleRow}>
          <Text style={styles.title}>Restore </Text>
          <Svg width={90} height={36} accessibilityLabel="Wallet">
            <Defs>
              <SvgGradient id="walletWord" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#3B82F6" />
                <Stop offset="1" stopColor="#8B5CF6" />
              </SvgGradient>
            </Defs>
            <SvgText x={0} y={27} fontSize={28} fontFamily="Inter-700" fontWeight="700" fill="url(#walletWord)">
              Wallet
            </SvgText>
          </Svg>
        </View>

        <Text style={styles.subtitle}>
          Enter your secret phrase to restore your wallet. This will give you access to your existing assets.
        </Text>

        {/* secret phrase card */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardIcon}>
              <DocIcon size={20} color={C.brand} />
            </View>
            <View style={styles.cardHeadText}>
              <Text style={styles.cardTitle}>Secret phrase</Text>
              <Text style={styles.cardDesc}>Enter the 12 or 24 word secret phrase in the correct order.</Text>
            </View>
          </View>

          <View style={styles.field}>
            <TextInput
              value={hidden ? maskPhrase(phrase) : phrase}
              onChangeText={(t) => {
                setPhrase(t);
                if (storeError) setStoreError(null);
              }}
              editable={!hidden}
              placeholder="Enter secret phrase"
              placeholderTextColor={C.muted}
              multiline={false}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              style={styles.input}
              testID="restorePhraseInput"
            />
            <Pressable
              hitSlop={10}
              onPress={() => setHidden((h) => !h)}
              style={styles.eye}
              testID="restoreHide"
              accessibilityLabel={hidden ? 'Show secret phrase' : 'Hide secret phrase'}
            >
              {hidden ? <EyeOffIcon size={20} color={C.muted} /> : <EyeIcon size={20} color={C.muted} />}
            </Pressable>
          </View>

          {hasText ? (
            <Pressable onPress={onClear} style={styles.clearBtn} testID="restoreClear">
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {/* safety card */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={[styles.cardIcon, styles.shieldIcon]}>
              <ShieldCheckIcon size={20} color="#12805C" />
            </View>
            <View style={styles.cardHeadText}>
              <Text style={styles.cardTitle}>Keep your phrase safe</Text>
              <Text style={styles.cardDesc}>
                Your secret phrase gives full access to your wallet. Never share it with anyone, and never store it online.
              </Text>
            </View>
          </View>
        </View>

        {problem ? (
          <Text style={styles.problem} testID="restoreProblem">{problem}</Text>
        ) : null}
        {storeError ? (
          <Text style={styles.problem} testID="restoreStoreError">{storeError}</Text>
        ) : null}

        <Pressable onPress={onPaste} style={styles.pasteRow} testID="restorePaste" accessibilityLabel="Paste">
          <CopyIcon size={20} color={C.ink} />
          <Text style={styles.pasteText}>Paste</Text>
          <ChevronRightIcon size={20} color={C.muted} />
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={restore}
          disabled={!valid || checking}
          style={[styles.continue, { opacity: !valid || checking ? 0.45 : 1 }]}
          testID="restoreContinue"
        >
          <LinearGradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            colors={['#6C63FF', '#4A90D9']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.continueText}>{checking ? 'Restoring…' : 'Continue'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollBody: { paddingHorizontal: 16, paddingBottom: 24 },
  art: { width: 224, height: 154, alignSelf: 'center', marginTop: 4, marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontFamily: 'Inter-700',
    fontWeight: '700',
    letterSpacing: -0.5,
    color: C.ink,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter-400',
    color: C.muted,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: C.bg,
    padding: 14,
    marginBottom: 12,
  },
  cardHead: { flexDirection: 'row', gap: 12 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldIcon: { backgroundColor: '#E8F6F1' },
  cardHeadText: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700', color: C.ink },
  cardDesc: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter-400', color: C.muted, marginTop: 3 },
  field: {
    marginTop: 12,
    height: 52,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.field,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter-500', color: C.ink, paddingVertical: 0 },
  eye: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  clearBtn: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: C.field },
  clearText: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600', color: C.ink },
  problem: { fontSize: 13, fontFamily: 'Inter-400', color: '#D63232', paddingHorizontal: 4, paddingBottom: 8 },
  pasteRow: {
    height: 52,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.bg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  pasteText: { flex: 1, fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', color: C.ink },
  footer: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: C.bg },
  continue: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  continueText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
});
