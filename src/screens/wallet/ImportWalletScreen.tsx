/**
 * Veltravia Wallet — "Multi-coin wallet" (restore from secret phrase).
 *
 * Matched to the current Trust build: wallet-name field with a clear button, a
 * tall secret-phrase box with a Paste action, the "typically 12 (sometimes 18,
 * 24) words separated by single spaces" helper, "Restore wallet", and a
 * "What is a secret phrase?" explainer.
 *
 * What Trust does NOT do is still enforced: the phrase is validated against the
 * real BIP-39 wordlist AND checksum before anything is stored, so a typo or an
 * invented twelve words cannot impersonate a wallet. The QR icon scans a phrase
 * and drops it into the box for review rather than restoring it directly.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { BackIcon, CloseIcon, ScanIcon } from '../../components/icons';
import { normalizeMnemonic, validateMnemonic } from '../../core/wallet/bip39';
import { walletManager } from '../../core/wallet/walletManager';
import { pasteFromClipboard } from '../../core/clipboard';
import { useWallets } from '../../wallets/WalletsProvider';
import { registerScanTarget } from '../../services/scanTarget';

export default function ImportWalletScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { nextWalletName, createWallet } = useWallets();

  const [name, setName] = useState(nextWalletName);
  const [phrase, setPhrase] = useState('');
  const [checking, setChecking] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);

  const words = normalizeMnemonic(phrase).split(' ').filter(Boolean);
  const check = validateMnemonic(phrase);
  const valid = check.ok;

  // Only surface a problem once there is something to be wrong about, and never
  // scold the user mid-word: silence while they are still typing the first word.
  const problem =
    !check.ok && words.length >= 3
      ? check.reason === 'count'
        ? 'A secret phrase is 12, 15, 18, 21 or 24 words.'
        : check.reason === 'unknown-word'
          ? `"${check.detail}" is not a secret-phrase word.`
          : check.reason === 'checksum'
            ? "That phrase doesn't add up. Check the words and their order."
            : null
      : null;

  const card = theme.mode === 'dark' ? theme.surfaceAlt : theme.surface;

  const onPaste = async () => {
    const pasted = await pasteFromClipboard();
    if (!pasted) return;
    setPhrase(pasted);
    if (storeError) setStoreError(null);
  };

  const onScan = () => {
    const off = registerScanTarget(async (value: string) => {
      off();
      // A scanned phrase fills the box; it is still validated before restoring.
      setPhrase(String(value));
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
    createWallet(name.trim() || nextWalletName(), 'default', 'violet', 'imported');
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const explainPhrase = () =>
    Alert.alert(
      'What is a secret phrase?',
      'A secret phrase (also called a recovery phrase) is the list of words that controls your wallet. ' +
        'Anyone who has it can move your funds, and it is the only way to restore this wallet if you lose the device.\n\n' +
        'Write it down on paper and keep it offline. Never type it into a website or share it in a chat.',
      [{ text: 'Got it' }],
    );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()} style={styles.backBtn} testID="importBack">
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Multi-coin wallet</Text>
        <Pressable hitSlop={12} onPress={onScan} style={styles.backBtn} testID="importScan">
          <ScanIcon size={22} color={theme.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.label, { color: theme.inkMuted }]}>Wallet name</Text>
        <View style={[styles.nameBox, { backgroundColor: card, borderColor: theme.border }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Wallet name"
            placeholderTextColor={theme.inkMuted}
            autoCorrect={false}
            style={[styles.nameInput, { color: theme.ink }]}
            testID="importNameInput"
          />
          {name.length > 0 ? (
            <Pressable hitSlop={10} onPress={() => setName('')} style={styles.clearBtn} testID="importNameClear">
              <CloseIcon size={16} color={theme.inkMuted} />
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.label, styles.phraseLabel, { color: theme.inkMuted }]}>Secret phrase</Text>
        <View
          style={[
            styles.phraseBox,
            { backgroundColor: card, borderColor: words.length > 0 ? theme.brand : theme.border },
          ]}
        >
          <TextInput
            value={phrase}
            onChangeText={(t) => {
              setPhrase(t);
              if (storeError) setStoreError(null);
            }}
            placeholder=""
            multiline
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            textAlignVertical="top"
            style={[styles.phraseInput, { color: theme.ink }]}
            testID="importPhraseInput"
          />
          <Pressable hitSlop={10} onPress={onPaste} style={styles.pasteBtn} testID="importPaste">
            <Text style={[styles.pasteText, { color: theme.brand }]}>Paste</Text>
          </Pressable>
        </View>

        <Text style={[styles.helper, { color: theme.inkMuted }]}>
          Typically 12 (sometimes 18, 24) words separated by single spaces
        </Text>

        {problem ? (
          <Text style={[styles.helper, styles.problem, { color: theme.negative }]} testID="importPhraseError">
            {problem}
          </Text>
        ) : null}
        {storeError ? (
          <Text style={[styles.helper, styles.problem, { color: theme.negative }]} testID="importStoreError">
            {storeError}
          </Text>
        ) : null}
        {valid ? (
          <Text style={[styles.helper, { color: theme.positive }]} testID="importPhraseOk">
            {words.length} words · phrase checks out
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={restore}
          disabled={!valid || checking}
          style={({ pressed }) => [
            styles.restoreBtn,
            {
              backgroundColor: theme.brand,
              opacity: !valid ? 0.45 : pressed ? 0.9 : 1,
            },
          ]}
          testID="importRestore"
        >
          <Text style={styles.restoreText}>{checking ? 'Restoring…' : 'Restore wallet'}</Text>
        </Pressable>

        <Pressable hitSlop={8} onPress={explainPhrase} style={styles.whatBtn} testID="importWhatIsPhrase">
          <Text style={[styles.whatText, { color: theme.brand }]}>What is a secret phrase?</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600', letterSpacing: -0.2 },
  body: { paddingHorizontal: 16, paddingBottom: 24 },
  label: { fontSize: 13, fontFamily: 'Inter-500', marginBottom: 8, marginTop: 12 },
  phraseLabel: { marginTop: 22 },
  nameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 52,
  },
  nameInput: { flex: 1, fontSize: 15, fontFamily: 'Inter-500', padding: 0 },
  clearBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  phraseBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 34,
    minHeight: 150,
  },
  phraseInput: {
    minHeight: 92,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter-400',
    padding: 0,
  },
  pasteBtn: { position: 'absolute', right: 14, bottom: 10 },
  pasteText: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
  helper: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter-400', marginTop: 8 },
  problem: { fontFamily: 'Inter-500' },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  restoreBtn: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  restoreText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600', color: '#FFFFFF' },
  whatBtn: { alignItems: 'center', paddingTop: 14 },
  whatText: { fontSize: 13, fontFamily: 'Inter-500' },
});
