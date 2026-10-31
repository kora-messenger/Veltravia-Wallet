/**
 * Veltravia Wallet — the "do not forget this" warning shown wherever the user
 * creates the secret that gates a locked wallet (Settings → Wallet Lock and
 * the AI lock card).
 *
 * Wording is intentional and must not be softened: a forgotten password or
 * passcode CAN lock the user out of their own wallet, and the product does not
 * take responsibility for that. "Learn more" opens the policy page as soon as
 * POLICY_URL in src/config/legal.ts is filled in.
 *
 * One copy, three presentations:
 *   <LockWarning />        inline amber block (AI lock card, compact)
 *   <LockWarningCard />    the Wallet Lock sheet's peach card
 *   <RecoveryNoteCard />   the separate "still restorable" note under it
 * The sentence and the Learn more handler live here so they cannot drift.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { showToast } from '../components/Toast';
import { AlertCircleIcon, LightbulbIcon } from '../components/icons';
import { openPolicy } from '../config/legal';

const AMBER = '#B45309';
const AMBER_BG = 'rgba(245,158,11,0.12)';

/** Peach card palette, sampled from the Wallet Lock reference (31 Oct 2026). */
const CARD = {
  warnBg: '#FCE9D6',
  warnInk: '#7A3E12',
  warnStrong: '#B4440A',
  warnIcon: '#F85A03',
  noteBg: '#FDE6D1',
};

export const LOCK_WARNING_TEXT =
  'Choose a password or passcode you will not forget. If you forget it while your account is locked, you may ' +
  'lose access to this wallet. Veltravia Wallet cannot recover it and is not responsible for any loss caused ' +
  'by a forgotten password or passcode.';

export const RECOVERY_NOTE_TEXT =
  "Your recovery phrase still restores the wallet itself — this password only unlocks this device's lock.";

/** Shared "Learn more" behaviour: open the policy, say so when it is not live. */
export function useLearnMore() {
  return React.useCallback(async () => {
    const res = await openPolicy();
    if (res === 'unset') showToast('The policy page is coming soon.', { kind: 'info' });
    if (res === 'failed') showToast("Couldn't open that link", { kind: 'error' });
  }, []);
}

/** The link itself; `tint` matches whichever card it sits in. */
export function LearnMoreLink({ tint = AMBER, style }: { tint?: string; style?: object }) {
  const onLearnMore = useLearnMore();
  return (
    <Text
      accessibilityRole="link"
      accessibilityLabel="Learn more about wallet lock recovery"
      testID="lockWarningLearnMore"
      onPress={onLearnMore}
      style={[styles.link, { color: tint }, style]}
    >
      Learn more
    </Text>
  );
}

export default function LockWarning({ compact = false }: { compact?: boolean }) {
  const { theme } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: AMBER_BG }]} testID="lockWarning">
      <AlertCircleIcon size={18} color={AMBER} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.body, { color: theme.mode === 'dark' ? '#F5C878' : AMBER }]}>
          {LOCK_WARNING_TEXT}{' '}
          <LearnMoreLink tint={theme.mode === 'dark' ? '#F5C878' : AMBER} />
        </Text>
        {!compact && <Text style={[styles.hint, { color: theme.inkMuted }]}>{RECOVERY_NOTE_TEXT}</Text>}
      </View>
    </View>
  );
}

/** Reference-styled warning card: peach, orange badge, readable line height. */
export function LockWarningCard() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  return (
    <View
      testID="lockWarningCard"
      style={[styles.card, { backgroundColor: dark ? 'rgba(248,90,3,0.14)' : CARD.warnBg }]}
    >
      <View style={[styles.badge, { backgroundColor: CARD.warnIcon }]}>
        <AlertCircleIcon size={16} color="#FFFFFF" />
      </View>
      <Text style={[styles.cardBody, { color: dark ? '#F7C9A3' : CARD.warnInk }]}>
        {LOCK_WARNING_TEXT}{' '}
        <LearnMoreLink tint={dark ? '#FDA96A' : CARD.warnStrong} />
      </Text>
    </View>
  );
}

/** The smaller, distinct card underneath: recovery still works. */
export function RecoveryNoteCard() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  return (
    <View testID="recoveryNoteCard" style={[styles.note, { backgroundColor: dark ? 'rgba(248,90,3,0.09)' : CARD.noteBg }]}>
      <LightbulbIcon size={16} color={dark ? '#FDA96A' : CARD.warnStrong} />
      <Text style={[styles.noteText, { color: dark ? '#F0BF97' : CARD.warnInk }]}>{RECOVERY_NOTE_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14 },
  body: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter-500', fontWeight: '500' },
  link: { fontFamily: 'Inter-700', fontWeight: '700', textDecorationLine: 'underline' },
  hint: { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter-400', fontWeight: '400' },
  card: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18 },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  cardBody: { flex: 1, fontSize: 12.5, lineHeight: 19, fontFamily: 'Inter-400', fontWeight: '400' },
  note: { flexDirection: 'row', gap: 9, padding: 12, borderRadius: 16, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17.5, fontFamily: 'Inter-400', fontWeight: '400' },
});
