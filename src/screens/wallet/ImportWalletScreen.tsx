/**
 * Veltravia Wallet — "Add existing wallet" (recovery phrase import).
 *
 * The phrase is checked for real: BIP-39 wordlist membership AND the checksum,
 * so a typo or a made-up 12 words cannot masquerade as a wallet. Only a valid
 * phrase is written to the keystore, through the same storeSeed call every
 * other wallet path uses.
 */

import PrimaryButton from '../../components/PrimaryButton';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { BackIcon } from '../../components/icons';
import { normalizeMnemonic, validateMnemonic } from '../../core/wallet/bip39';
import { walletManager } from '../../core/wallet/walletManager';

export default function ImportWalletScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [phrase, setPhrase] = useState('');
  const [checking, setChecking] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);

  const words = normalizeMnemonic(phrase).split(' ').filter(Boolean);
  const check = validateMnemonic(phrase);
  const valid = check.ok;
  const error =
    !check.ok && words.length > 0
      ? check.reason === 'count'
        ? 'A recovery phrase is 12, 15, 18, 21 or 24 words.'
        : check.reason === 'unknown-word'
          ? `"${check.detail}" is not a recovery-phrase word.`
          : check.reason === 'checksum'
            ? "That phrase doesn't add up. Check the words and their order."
            : null
      : null;

  const surface = theme.mode === 'dark' ? theme.surfaceAlt : theme.surface;

  const handleContinue = async () => {
    if (!valid || checking) return;
    setChecking(true);
    const stored = await walletManager.importWallet(phrase);
    setChecking(false);
    if (!stored) {
      // WalletCore disagreed, or the keystore refused. Say so; do not proceed
      // to a wallet that has no phrase behind it.
      setStoreError('That phrase could not be stored on this device. Try again.');
      return;
    }
    navigation.replace('NameWallet', { origin: 'imported' });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()} style={styles.backBtn}>
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Add existing wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={[styles.hint, { color: theme.inkMuted }]}>
          Enter your recovery phrase to restore an existing wallet.
        </Text>

        <View style={[styles.box, { backgroundColor: surface, borderColor: theme.border }]}>
          <TextInput
            value={phrase}
            placeholder="Type or paste your recovery phrase"
            placeholderTextColor={theme.inkMuted}
            multiline
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.input, { color: theme.ink }]}
            testID="importPhraseInput"
            onChangeText={(t) => {
              setPhrase(t);
              if (storeError) setStoreError(null);
            }}
          />
        </View>

        <Text style={[styles.count, { color: valid ? theme.positive : theme.inkMuted }]} testID="importWordCount">
          {words.length === 0 ? '12 or 24 words' : `${words.length} word${words.length === 1 ? '' : 's'}`}
          {valid ? ' · phrase checks out' : ''}
        </Text>

        {(error || storeError) && (
          <Text style={[styles.count, { color: '#E5484D' }]} testID="importPhraseError">
            {storeError ?? error}
          </Text>
        )}
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 12, paddingHorizontal: 20 }}>
        <PrimaryButton label="Continue" onPress={handleContinue} loading={checking} disabled={!valid} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: 'Inter-700', fontWeight: '800', letterSpacing: -0.3 },

  body: { paddingHorizontal: 20, paddingTop: 12 },
  hint: { fontFamily: 'Inter-400', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  box: {
    borderRadius: 14,
    borderWidth: 1.4,
    padding: 14,
    minHeight: 150,
  },
  input: { fontFamily: 'Inter-400', fontSize: 15, lineHeight: 22, textAlignVertical: 'top' },
  count: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 10 },

  btn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },
});
