/**
 * Veltravia Wallet — the block the user sees when value movement is refused.
 *
 * One component, so a locked wallet says the same thing on every surface
 * (Swap, Send, Perps, the AI chat) and, crucially, distinguishes:
 *   • locked here          -> "unlock it" (they can, right now);
 *   • locked on another    -> "Account locked. Unlock your account on the
 *                             older device where you locked it." — this device
 *                             cannot lift it, so we never offer a button that
 *                             would fail.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { ShieldLockIcon } from './icons';
import type { MovementBlock } from '../core/security/valueGuard';
import { movementBlockTitle, movementBlockMessage } from '../core/security/valueGuard';

export default function LockedNotice({ block, compact = false }: { block: MovementBlock; compact?: boolean }) {
  const { theme } = useTheme();
  if (!block) return null;
  const elsewhere = block.kind === 'locked-elsewhere';
  const tint = elsewhere ? '#B45309' : theme.brand;
  const bg = elsewhere ? 'rgba(245,158,11,0.12)' : theme.mode === 'dark' ? 'rgba(255,255,255,0.07)' : '#F1F1F5';

  return (
    <View style={[styles.wrap, { backgroundColor: bg }, compact && styles.compact]} testID="lockedNotice">
      <View style={[styles.icon, { backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : '#FFFFFF' }]}>
        <ShieldLockIcon size={20} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.title, { color: theme.ink }]}>{movementBlockTitle(block)}</Text>
        <Text style={[styles.body, { color: theme.inkMuted }]}>{movementBlockMessage(block)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, alignItems: 'flex-start' },
  compact: { padding: 10, borderRadius: 12 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontFamily: 'Inter-700', fontWeight: '700' },
  body: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter-400', fontWeight: '400' },
});
