/**
 * Veltravia Wallet — the "do not forget this" warning shown wherever the user
 * creates the secret that gates a locked wallet (Settings → Wallet Lock and
 * the AI lock card).
 *
 * Wording is intentional and must not be softened: a forgotten password or
 * passcode CAN lock the user out of their own wallet, and the product does not
 * take responsibility for that. "Learn more" is already clickable; it opens
 * the policy page as soon as POLICY_URL in src/config/legal.ts is filled in.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { showToast } from '../components/Toast';
import { AlertCircleIcon } from '../components/icons';
import { openPolicy } from '../config/legal';

const AMBER = '#B45309';
const AMBER_BG = 'rgba(245,158,11,0.12)';

export default function LockWarning({ compact = false }: { compact?: boolean }) {
  const { theme } = useTheme();

  const onLearnMore = async () => {
    const res = await openPolicy();
    if (res === 'unset') showToast('The policy page is coming soon.', { kind: 'info' });
    if (res === 'failed') showToast("Couldn't open that link", { kind: 'error' });
  };

  return (
    <View style={[styles.wrap, { backgroundColor: AMBER_BG }]} testID="lockWarning">
      <AlertCircleIcon size={18} color={AMBER} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.body, { color: theme.mode === 'dark' ? '#F5C878' : AMBER }]}>
          Choose a password or passcode you will not forget. If you forget it while your account is locked, you may
          lose access to this wallet. Veltravia Wallet cannot recover it and is not responsible for any loss caused
          by a forgotten password or passcode.{' '}
          <Text
            accessibilityRole="link"
            accessibilityLabel="Learn more about wallet lock recovery"
            testID="lockWarningLearnMore"
            onPress={onLearnMore}
            style={styles.link}
          >
            Learn more
          </Text>
        </Text>
        {!compact && (
          <Text style={[styles.hint, { color: theme.inkMuted }]}>
            Your recovery phrase still restores the wallet itself — this password only unlocks this device's lock.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14 },
  body: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter-500', fontWeight: '500' },
  link: { fontFamily: 'Inter-700', fontWeight: '700', textDecorationLine: 'underline' },
  hint: { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter-400', fontWeight: '400' },
});
