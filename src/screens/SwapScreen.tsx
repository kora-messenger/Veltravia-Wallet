/**
 * Veltravia Wallet — Swap tab. v2 feature; ships as designed "coming soon".
 *
 * A locked wallet may not be "active" for swaps even once this screen is real,
 * so the lock check lives here from the start: the tab reads the shared
 * movement guard and refuses before any quote is ever requested.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useWallets } from '../wallets/WalletsProvider';
import { movementBlock } from '../core/security/valueGuard';
import LockedNotice from '../components/LockedNotice';

export default function SwapScreen() {
  const { theme } = useTheme();
  const { activeWallet } = useWallets();
  const block = movementBlock(activeWallet.id);

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: theme.ink }]}>Swap</Text>
        {block ? (
          <View style={styles.notice}>
            <LockedNotice block={block} />
          </View>
        ) : (
          <Text style={[styles.sub, { color: theme.inkMuted }]}>
            Token swapping arrives in a Veltravia update.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  notice: { alignSelf: 'stretch', marginTop: 12 },
  title: { fontSize: 28, fontFamily: 'Inter-700', fontWeight: '800', marginBottom: 8, lineHeight: 39 },
  sub: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500', textAlign: 'center' },
});
