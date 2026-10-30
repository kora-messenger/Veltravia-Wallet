/**
 * Veltravia Wallet — "Secret phrase" (restored to Trust's current layout).
 *
 * Order of protection, and nothing weaker:
 *   1. Manage account → Show secret phrase → acknowledgement sheet → passcode.
 *   2. This screen opens with the words CONCEALED. The card shows a redacted
 *      phrase, a "12 words" label and a Show pill.
 *   3. Show → "Keep your secret phrase safe" popup → "I understand" → the words
 *      appear inside the card. That popup is the only thing in front of the words
 *      here, exactly as in the current build.
 *   4. "I've already backed this up" (a card pinned above the button) must be ticked
 *      before Done lights up. Done then shows a small spinner at its right corner
 *      for a beat and returns to Manage account, as in the current build.
 *
 * The phrase is read from the keystore on mount and kept in component state only,
 * so leaving the screen drops it. It is never logged.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { BackIcon, CheckIcon, CopyIcon, InfoCircleIcon } from '../../components/icons';
import { showToast } from '../../components/Toast';
import { walletManager } from '../../core/wallet/walletManager';
import { copyToClipboard } from '../../core/clipboard';
import SecretPhraseIntroSheet from '../../components/SecretPhraseIntroSheet';

export default function SecretPhraseScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [phrase, setPhrase] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    walletManager
      .revealSeed()
      .then((p) => {
        if (alive) setPhrase(p);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const words = phrase ? phrase.split(' ') : [];

  const onShow = () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    setIntroOpen(true);
  };

  const onDone = () => {
    if (!backedUp || finishing) return;
    // Spinner at the corner of the button, then back to Manage account. The words
    // are dropped on unmount, so there is nothing to clear here.
    setFinishing(true);
    closeTimer.current = setTimeout(onBack, 900);
  };

  const copy = () => {
    if (!phrase) return;
    // Sensitive: the platform keeps it out of the clipboard preview and history.
    const ok = copyToClipboard(phrase, { sensitive: true });
    showToast(ok ? 'Secret phrase copied' : 'Could not copy on this device', {
      kind: ok ? 'success' : 'info',
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={10} onPress={onBack} style={styles.backBtn} testID="phraseBack">
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Secret phrase</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View
          style={[styles.card, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
          testID="phraseCard"
        >
          {!loaded ? (
            <View style={styles.redacted}>
              <View style={[styles.ghost, { backgroundColor: theme.border }]} />
              <View style={[styles.ghost, { backgroundColor: theme.border }]} />
              <View style={[styles.ghost, { backgroundColor: theme.border, width: '62%' }]} />
            </View>
          ) : !phrase ? (
            <Text style={[styles.missing, { color: theme.inkMuted }]}>
              No secret phrase is stored on this device yet.
            </Text>
          ) : revealed ? (
            <View style={styles.wordGrid}>
              {words.map((word, i) => (
                <View
                  key={`${word}-${i}`}
                  style={[styles.wordChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Text style={[styles.wordIndex, { color: theme.inkMuted }]}>{i + 1}</Text>
                  <Text style={[styles.word, { color: theme.ink }]} testID={`phraseWord${i}`}>
                    {word}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            // Concealed: generic bars, never the words under a translucent cover.
            <View style={styles.redacted} testID="phraseConcealed">
              <View style={[styles.ghost, { backgroundColor: theme.border }]} />
              <View style={[styles.ghost, { backgroundColor: theme.border }]} />
              <View style={[styles.ghost, { backgroundColor: theme.border, width: '72%' }]} />
            </View>
          )}

          <View style={styles.cardFooter}>
            <Text style={[styles.count, { color: theme.inkMuted }]}>
              {phrase ? `${words.length} words` : '12 words'}
            </Text>
            <View style={styles.footerRight}>
              {revealed ? (
                <Pressable hitSlop={10} onPress={copy} style={styles.copyBtn} testID="phraseCopy">
                  <CopyIcon size={18} color={theme.inkMuted} />
                </Pressable>
              ) : null}
              {phrase ? (
                <Pressable
                  onPress={onShow}
                  style={({ pressed }) => [
                    styles.showPill,
                    { backgroundColor: theme.surface, opacity: pressed ? 0.8 : 1 },
                  ]}
                  testID="phraseShow"
                >
                  <Text style={[styles.showText, { color: theme.ink }]}>{revealed ? 'Hide' : 'Show'}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.warning, { backgroundColor: theme.negative }]} testID="phraseWarning">
          <InfoCircleIcon size={20} color="#FFFFFF" />
          <Text style={styles.warningText}>
            Never share this secret phrase with anyone. Write it down and keep it somewhere only you can
            access.
          </Text>
        </View>

      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={[styles.checkRow, { backgroundColor: theme.surfaceAlt }]}
          onPress={() => !finishing && setBackedUp((v) => !v)}
          testID="phraseBackedUp"
        >
          <View
            style={[
              styles.checkBox,
              backedUp
                ? { backgroundColor: theme.brand, borderColor: theme.brand }
                : { borderColor: theme.inkMuted },
            ]}
          >
            {backedUp ? <CheckIcon size={13} color="#FFFFFF" /> : null}
          </View>
          <Text style={[styles.checkText, { color: theme.ink }]}>I've already backed this up</Text>
        </Pressable>

        <Pressable
          onPress={onDone}
          disabled={!backedUp || finishing}
          style={({ pressed }) => [
            styles.done,
            { backgroundColor: theme.brand, opacity: !backedUp ? 0.4 : pressed ? 0.9 : 1 },
          ]}
          testID="phraseDone"
        >
          <Text style={styles.doneText}>Done</Text>
          {finishing ? (
            <View style={styles.doneSpinner} testID="phraseDoneSpinner">
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : null}
        </Pressable>
      </View>

      <SecretPhraseIntroSheet
        visible={introOpen}
        onClose={() => setIntroOpen(false)}
        onUnderstand={() => {
          setIntroOpen(false);
          setRevealed(true);
        }}
      />
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
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  redacted: { gap: 10, paddingVertical: 6 },
  ghost: { height: 12, borderRadius: 6, opacity: 0.7 },
  missing: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter-400', paddingVertical: 10 },
  wordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  wordIndex: { fontSize: 11, fontFamily: 'Inter-500' },
  word: { fontSize: 14, fontFamily: 'Inter-500' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  count: { fontSize: 13, fontFamily: 'Inter-500' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copyBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  showPill: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 6 },
  showText: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
  warning: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  warningText: { flex: 1, color: '#FFFFFF', fontSize: 13, lineHeight: 19, fontFamily: 'Inter-500' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 10,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { fontSize: 14, fontFamily: 'Inter-500' },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  done: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  doneSpinner: { position: 'absolute', right: 18, top: 0, bottom: 0, justifyContent: 'center' },
  doneText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
});
