/**
 * Veltravia Wallet — "Add existing wallet" (recovery phrase import).
 *
 * v1: the phrase textarea + word count. Phase 2 (Wallet Core) validates the
 * phrase and derives real keys; for now a 12/24-word phrase continues to the
 * "Name your wallet" screen with origin 'imported'.
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
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { BackIcon } from '../../components/icons';

export default function ImportWalletScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [phrase, setPhrase] = useState('');
  const [checking, setChecking] = useState(false);

  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const valid = words.length === 12 || words.length === 24;

  const surface = theme.mode === 'dark' ? theme.surfaceAlt : theme.surface;

  const handleContinue = () => {
    if (!valid || checking) return;
    setChecking(true);
    // Phase 2: Wallet Core validates + derives. v1 proceeds to naming.
    setTimeout(() => {
      navigation.replace('NameWallet', { origin: 'imported' });
    }, 600);
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
            onChangeText={setPhrase}
            placeholder="Type or paste your recovery phrase"
            placeholderTextColor={theme.inkMuted}
            multiline
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.input, { color: theme.ink }]}
          />
        </View>

        <Text style={[styles.count, { color: valid ? theme.positive : theme.inkMuted }]}>
          {words.length === 0 ? '12 or 24 words' : `${words.length} word${words.length === 1 ? '' : 's'}`}
        </Text>
      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 12, paddingHorizontal: 20 }}>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: theme.brandGradient[0], opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleContinue}
          disabled={!valid || checking}
        >
          {checking ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continue</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },

  body: { paddingHorizontal: 20, paddingTop: 12 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  box: {
    borderRadius: 14,
    borderWidth: 1.4,
    padding: 14,
    minHeight: 150,
  },
  input: { fontSize: 15, lineHeight: 22, textAlignVertical: 'top' },
  count: { fontSize: 13, fontWeight: '600', marginTop: 10 },

  btn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
