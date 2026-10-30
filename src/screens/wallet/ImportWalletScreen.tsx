/**
 * Veltravia Wallet — "Restore wallet" (secret phrase entry).
 *
 * Layout, as specified (Trust restore screen, Veltravia skin):
 *   • back chevron top-left, NOTHING in the top middle, animated scanner
 *     icon top-right
 *   • the screen name "Restore wallet" sits under the back arrow, left aligned
 *   • one big box filling the screen. Its placeholder "Enter secret phrase" is
 *     centred in the middle of the box, and the words start exactly there and
 *     wrap onto new centred lines as they run long
 *   • bottom-right inside the box: "Paste" in the app's own colour. As soon as
 *     the box has anything in it, Paste disappears and two grey pills appear:
 *     Clear and Hide. Hide masks the words and becomes Show; Show puts them back
 *   • Continue at the bottom stays disabled until the phrase is a real BIP-39
 *     phrase (wordlist membership AND checksum), so a typo cannot slip through
 *
 * The phrase is never logged and only reaches the keystore on a valid Continue.
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { BackIcon, ScanIcon } from '../../components/icons';
import { normalizeMnemonic, validateMnemonic } from '../../core/wallet/bip39';
import { walletManager } from '../../core/wallet/walletManager';
import { pasteFromClipboard } from '../../core/clipboard';
import { useWallets } from '../../wallets/WalletsProvider';
import { registerScanTarget } from '../../services/scanTarget';

/** Keep the word count and spacing, lose the words themselves. */
function maskPhrase(phrase: string): string {
  return phrase.replace(/[^\s]+/g, (word) => '•'.repeat(Math.max(4, Math.min(10, word.length))));
}

export default function ImportWalletScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
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
    const off = registerScanTarget(async (value: string) => {
      off();
      // A scanned phrase fills the box for review; it is still validated.
      setPhrase(String(value));
      setHidden(false);
      if (storeError) setStoreError(null);
    });
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
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()} style={styles.backBtn} testID="restoreBack">
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <View style={styles.headerCenter} />
        <Pressable hitSlop={12} onPress={onScan} style={styles.scanBtn} testID="restoreScan">
          <Animated.View style={scanStyle}>
            <ScanIcon size={22} color={theme.ink} />
          </Animated.View>
        </Pressable>
      </View>

      <Text style={[styles.screenTitle, { color: theme.ink }]}>Restore wallet</Text>

      <View style={[styles.box, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
        <TextInput
          value={hidden ? maskPhrase(phrase) : phrase}
          onChangeText={(t) => {
            setPhrase(t);
            if (storeError) setStoreError(null);
          }}
          editable={!hidden}
          placeholder="Enter secret phrase"
          placeholderTextColor={theme.inkMuted}
          multiline
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          textAlign="center"
          textAlignVertical="center"
          style={[styles.input, { color: theme.ink }]}
          testID="restorePhraseInput"
        />

        {hasText ? (
          <View style={styles.actions}>
            <Pressable
              onPress={onClear}
              style={[styles.grayPill, { backgroundColor: theme.surface, borderColor: theme.border }]}
              testID="restoreClear"
            >
              <Text style={[styles.grayText, { color: theme.ink }]}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => setHidden((h) => !h)}
              style={[styles.grayPill, { backgroundColor: theme.surface, borderColor: theme.border }]}
              testID="restoreHide"
            >
              <Text style={[styles.grayText, { color: theme.ink }]}>{hidden ? 'Show' : 'Hide'}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onPaste} style={styles.pasteBtn} testID="restorePaste">
            <Text style={[styles.pasteText, { color: theme.brand }]}>Paste</Text>
          </Pressable>
        )}
      </View>

      {problem ? (
        <Text style={[styles.problem, { color: theme.negative }]} testID="restoreProblem">
          {problem}
        </Text>
      ) : null}
      {storeError ? (
        <Text style={[styles.problem, { color: theme.negative }]} testID="restoreStoreError">
          {storeError}
        </Text>
      ) : null}

      <Pressable
        onPress={restore}
        disabled={!valid || checking}
        style={[
          styles.continue,
          { backgroundColor: theme.brand, opacity: !valid || checking ? 0.4 : 1 },
        ]}
        testID="restoreContinue"
      >
        <Text style={styles.continueText}>{checking ? 'Restoring…' : 'Continue'}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: undefined },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  scanBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  screenTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontFamily: 'Inter-700',
    fontWeight: '700',
    letterSpacing: -0.4,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  box: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter-400',
    paddingHorizontal: 4,
    paddingTop: 0,
    paddingBottom: 0,
  },
  actions: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', gap: 8 },
  grayPill: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 7 },
  grayText: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
  pasteBtn: { position: 'absolute', right: 8, bottom: 6, paddingHorizontal: 12, paddingVertical: 8 },
  pasteText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  problem: { fontSize: 13, fontFamily: 'Inter-400', paddingHorizontal: 20, paddingBottom: 8 },
  continue: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 26,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
});
