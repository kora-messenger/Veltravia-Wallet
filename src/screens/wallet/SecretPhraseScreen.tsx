/**
 * Veltravia Wallet — "Your secret phrase" (the reveal screen).
 *
 * Reachable only through the Trust path: Manage account → Show secret phrase →
 * acknowledgement sheet → passcode. By the time this screen mounts the user has
 * already cleared both gates, so the words are shown straight away, in one box,
 * in order. Copy puts them on the clipboard; hiding them again is one tap.
 *
 * Nothing here writes, logs or caches the phrase: it is read from the keystore on
 * mount and lives in component state only, so leaving the screen drops it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { BackIcon, CopyIcon, EyeIcon } from '../../components/icons';
import { showToast } from '../../components/Toast';
import { walletManager } from '../../core/wallet/walletManager';
import { copyToClipboard } from '../../core/clipboard';
import { normalizeMnemonic } from '../../core/wallet/bip39';

export default function SecretPhraseScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [phrase, setPhrase] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    walletManager
      .revealSeed()
      .then((value) => {
        if (!alive) return;
        if (!value) {
          setMissing(true);
          return;
        }
        setPhrase(normalizeMnemonic(value));
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, []);

  const words = phrase ? phrase.split(' ') : [];

  const copy = useCallback(() => {
    if (!phrase) return;
    // Marked sensitive so Android keeps it off the clipboard history and the
    // usual toast-from-paste surfaces. It is still the user's choice to copy.
    copyToClipboard(phrase, { sensitive: true });
    showToast('Secret phrase copied. Keep it somewhere safe.', { kind: 'success' });
  }, [phrase]);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={10} onPress={onBack} style={styles.backBtn} testID="secretPhraseBack">
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Your secret phrase</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={[styles.bodyText, { color: theme.inkMuted }]}>
          These {words.length || 12} words are the only way to restore this wallet. Anyone who has them can take
          your funds, so never share them and never type them into a website.
        </Text>

        {missing ? (
          <Text style={[styles.error, { color: theme.negative }]} testID="secretPhraseMissing">
            No secret phrase is stored on this device.
          </Text>
        ) : null}

        {phrase ? (
          <>
            <View
              style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}
              testID="secretPhraseBox"
            >
              {hidden ? (
                <Text style={[styles.bodyText, { color: theme.inkMuted }]}>Phrase hidden</Text>
              ) : (
                <Text style={[styles.phrase, { color: theme.ink }]} testID="secretPhraseText">
                  {phrase}
                </Text>
              )}
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() => setHidden((h) => !h)}
                style={[styles.ghost, { borderColor: theme.border }]}
                testID="secretPhraseHide"
              >
                <EyeIcon size={20} color={theme.ink} />
                <Text style={[styles.ghostText, { color: theme.ink }]}>{hidden ? 'Show' : 'Hide'}</Text>
              </Pressable>
              <Pressable
                onPress={copy}
                style={[styles.ghost, { borderColor: theme.border }]}
                testID="secretPhraseCopy"
              >
                <CopyIcon size={20} color={theme.ink} />
                <Text style={[styles.ghostText, { color: theme.ink }]}>Copy</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, minHeight: 64, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600', letterSpacing: -0.2 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  bodyText: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter-400' },
  box: { marginTop: 18, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  phrase: { fontSize: 16, lineHeight: 26, fontFamily: 'Inter-500', letterSpacing: 0.2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ghostText: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600' },
  error: { marginTop: 18, fontSize: 14, fontFamily: 'Inter-500' },
});
