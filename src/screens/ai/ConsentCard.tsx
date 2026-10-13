/**
 * Veltravia AI — consent card (mirrors Trust's "Allow check" card).
 * The AI reads nothing from the wallet until the user taps Allow.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { CheckIcon, CloseIcon, InfoCircleIcon } from '../../components/icons';
import type { ChatMessage, ConsentRequest } from '../../ai/protocol';

const GREEN = '#12915E';

export default function ConsentCard({
  request,
  resolved,
  onAllow,
  onDecline,
}: {
  request: ConsentRequest;
  resolved?: ChatMessage['resolved'];
  onAllow: () => void;
  onDecline: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const panel = dark ? 'rgba(255,255,255,0.07)' : '#F1F1F5';
  const rule = dark ? 'rgba(255,255,255,0.12)' : 'rgba(6,14,44,0.10)';

  return (
    <View>
      <View style={[styles.card, { backgroundColor: panel }]}>
        <View style={styles.row}>
          <Text style={[styles.k, { color: theme.inkMuted }]}>Wallet</Text>
          <Text style={[styles.v, { color: theme.ink }]}>{request.wallet}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.k, { color: theme.inkMuted }]}>Networks</Text>
          <Text style={[styles.v, { color: theme.ink }]}>{request.networks} networks</Text>
        </View>
        <Text style={[styles.access, { color: theme.ink }]}>{request.access}</Text>
        <View style={[styles.rule, { backgroundColor: rule }]} />
        <View style={styles.foot}>
          <InfoCircleIcon size={20} color={theme.inkMuted} />
          <Text style={[styles.footText, { color: theme.inkMuted }]}>{request.footnote}</Text>
        </View>
      </View>

      {!resolved && (
        <View style={styles.btns}>
          <Pressable onPress={onAllow} style={({ pressed }) => [styles.pill, { backgroundColor: GREEN, opacity: pressed ? 0.85 : 1 }]}>
            <CheckIcon size={18} color="#fff" />
            <Text style={[styles.pillText, { color: '#fff' }]}>Allow check</Text>
          </Pressable>
          <Pressable
            onPress={onDecline}
            style={({ pressed }) => [styles.pill, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : '#E4E4EA', opacity: pressed ? 0.7 : 1 }]}
          >
            <CloseIcon size={18} color={theme.ink} />
            <Text style={[styles.pillText, { color: theme.ink }]}>Not now</Text>
          </Pressable>
        </View>
      )}
      {resolved === 'allowed' && <Text style={[styles.done, { color: GREEN }]}>Allowed for this conversation</Text>}
      {resolved === 'declined' && <Text style={[styles.done, { color: theme.inkMuted }]}>Not allowed</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 18, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { fontSize: 15, fontFamily: 'Inter-500', fontWeight: '500' },
  v: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700' },
  access: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700', textAlign: 'center', marginTop: 10 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  foot: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  footText: { flex: 1, fontSize: 13.5, lineHeight: 20, fontFamily: 'Inter-500', fontWeight: '500' },
  btns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pill: { height: 46, borderRadius: 23, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillText: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700' },
  done: { fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 12 },
});
