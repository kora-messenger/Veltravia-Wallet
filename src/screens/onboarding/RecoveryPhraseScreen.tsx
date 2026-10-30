/**
 * Veltravia Wallet — "Your recovery phrase", the screen that makes a new wallet
 * a real wallet.
 *
 * Until now "Create a new wallet" went straight to the home screen and nothing
 * was ever generated, so there was no phrase to lose or restore. This screen
 * generates a BIP-39 phrase from the platform CSPRNG, shows it once, makes the
 * user prove they wrote it down (three words in order), and only then stores it
 * in the keystore.
 *
 * Rules that matter here:
 *   • The phrase is never written to storage until the quiz passes, so backing
 *     out leaves no half-created wallet behind.
 *   • The phrase is never logged, never put in a toast, never sent anywhere.
 *   • Copy is explicit that Veltravia cannot restore it for the user.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, StatusBar, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { BackIcon, CheckIcon, ShieldLockIcon } from '../../components/icons';
import PrimaryButton from '../../components/PrimaryButton';
import { generateMnemonic, quizPositions, validateMnemonic } from '../../core/wallet/bip39';
import { walletManager } from '../../core/wallet/walletManager';

type Stage = 'gate' | 'show' | 'quiz' | 'saving' | 'failed';

const ACKS = [
  'I understand Veltravia Wallet cannot recover this phrase for me.',
  'I understand anyone with this phrase can take my funds.',
];

export default function RecoveryPhraseScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  /** Called once the phrase is confirmed and stored. */
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const [stage, setStage] = useState<Stage>('gate');
  const [acks, setAcks] = useState<boolean[]>([false, false]);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);

  // Generated once per mount, in memory only. A remount means a new phrase, so
  // the user can never be quizzed on words they were not shown.
  const phrase = useMemo(() => generateMnemonic(128), []);
  const words = useMemo(() => phrase.split(' '), [phrase]);
  const picks = useMemo(() => quizPositions(words.length, 3), [words.length]);

  useEffect(() => {
    setAnswers(['', '', '']);
  }, [stage]);

  const acknowledge = (i: number) => {
    setAcks((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const finish = useCallback(async () => {
    const typed = picks.map((p) => (answers[picks.indexOf(p)] ?? '').trim().toLowerCase());
    const correct = picks.every((wordIndex, slot) => typed[slot] === words[wordIndex]);
    if (!correct) {
      setError("One of those words doesn't match. Check the phrase again.");
      return;
    }
    if (!validateMnemonic(phrase).ok) {
      setError('Something went wrong generating this phrase. Please start again.');
      setStage('failed');
      return;
    }
    setError(null);
    setStage('saving');
    const stored = await walletManager.commitPhrase(phrase);
    if (!stored) {
      setStage('failed');
      setError('This device refused to store the phrase. Check your screen lock and try again.');
      return;
    }
    onDone();
  }, [answers, onDone, phrase, picks, words]);

  const canContinue = acks.every(Boolean);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={onBack} style={styles.backBtn} testID="phraseBack">
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Your recovery phrase</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {stage === 'gate' ? (
          <>
            <View style={[styles.badge, { backgroundColor: theme.surface }]}>
              <ShieldLockIcon size={26} color={theme.brand} />
            </View>
            <Text style={[styles.headline, { color: theme.ink }]}>For your eyes only</Text>
            <Text style={[styles.bodyText, { color: theme.inkMuted }]}>
              These 12 words are the only way to restore this wallet. Write them down in order and keep them offline.
            </Text>

            {ACKS.map((text, i) => (
              <Pressable
                key={text}
                onPress={() => acknowledge(i)}
                style={[styles.ackRow, { borderColor: acks[i] ? theme.brand : theme.border }]}
                testID={`phraseAck${i}`}
              >
                <View style={[styles.checkbox, { borderColor: acks[i] ? theme.brand : theme.border, backgroundColor: acks[i] ? theme.brand : 'transparent' }]}>
                  {acks[i] ? <CheckIcon size={13} color="#FFFFFF" /> : null}
                </View>
                <Text style={[styles.ackText, { color: theme.ink }]}>{text}</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {stage === 'show' ? (
          <>
            <Text style={[styles.headline, { color: theme.ink }]}>Write these down</Text>
            <Text style={[styles.bodyText, { color: theme.inkMuted }]}>
              Copy them in this exact order. You will confirm three of them on the next screen.
            </Text>

            <View style={[styles.wordGrid, revealed ? null : styles.hidden]}>
              {words.map((w, i) => (
                <View key={`${w}-${i}`} style={[styles.wordChip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.wordIndex, { color: theme.inkMuted }]}>{i + 1}</Text>
                  <Text style={[styles.word, { color: theme.ink }]} testID={`phraseWord${i}`}>
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            {!revealed ? (
              <Pressable onPress={() => setRevealed(true)} style={styles.revealBtn} testID="phraseReveal">
                <Text style={[styles.revealText, { color: theme.brand }]}>Tap to reveal</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {stage === 'quiz' ? (
          <>
            <Text style={[styles.headline, { color: theme.ink }]}>Confirm your phrase</Text>
            <Text style={[styles.bodyText, { color: theme.inkMuted }]}>
              Type the requested words from the phrase you just wrote down.
            </Text>

            {picks.map((wordIndex, slot) => (
              <View key={wordIndex} style={styles.quizRow}>
                <Text style={[styles.quizLabel, { color: theme.inkMuted }]}>Word #{wordIndex + 1}</Text>
                <TextInput
                  value={answers[slot] ?? ''}
                  onChangeText={(t) => {
                    setError(null);
                    setAnswers((prev) => prev.map((v, i) => (i === slot ? t : v)));
                  }}
                  placeholder="word"
                  placeholderTextColor={theme.inkMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.quizInput, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.border }]}
                  testID={`phraseAnswer${slot}`}
                />
              </View>
            ))}
          </>
        ) : null}

        {error ? (
          <Text style={styles.error} testID="phraseError">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {stage === 'gate' ? (
          <PrimaryButton
            label="Show my phrase"
            onPress={() => setStage('show')}
            disabled={!canContinue}
          />
        ) : null}
        {stage === 'show' ? (
          <PrimaryButton label="I've written it down" onPress={() => setStage('quiz')} disabled={!revealed} />
        ) : null}
        {stage === 'quiz' ? (
          <PrimaryButton
            label="Finish"
            onPress={finish}
            disabled={answers.some((a) => !a.trim())}
          />
        ) : null}
        {stage === 'saving' ? <PrimaryButton label="Saving…" onPress={() => {}} disabled loading /> : null}
        {stage === 'failed' ? <PrimaryButton label="Try again" onPress={() => setStage('quiz')} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: 'Inter-700', fontWeight: '800', letterSpacing: -0.3 },

  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  headline: { fontSize: 20, lineHeight: 28, fontFamily: 'Inter-700', fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  bodyText: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter-400', marginBottom: 16 },

  ackRow: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.4, borderRadius: 14, padding: 14, marginBottom: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.6, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1 },
  ackText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: 'Inter-400' },

  wordGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  hidden: { opacity: 0 },
  wordChip: { width: '48.5%', flexDirection: 'row', alignItems: 'center', borderWidth: 1.2, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 10 },
  wordIndex: { fontSize: 12, fontFamily: 'Inter-500', width: 22 },
  word: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600' },
  revealBtn: { alignItems: 'center', paddingVertical: 12 },
  revealText: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600' },

  quizRow: { marginBottom: 12 },
  quizLabel: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600', marginBottom: 6 },
  quizInput: { borderWidth: 1.4, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter-500' },

  error: { color: '#E5484D', fontSize: 13, lineHeight: 19, fontFamily: 'Inter-500', marginTop: 8 },
  footer: { paddingHorizontal: 20, paddingBottom: 12 },
});
