/**
 * Veltravia AI — transfer approval card.
 *
 * Shows everything the user needs BEFORE approving: amount, USD value,
 * recipient (full address, never truncated into ambiguity), network, fee,
 * total and warnings. The Approve button is the ONLY thing that can start
 * the authenticate-and-send step. Expired / resolved cards are read-only.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import CoinLogo from '../../components/CoinLogo';
import { AlertCircleIcon, CheckIcon, CloseIcon } from '../../components/icons';
import type { ChatMessage, TransferProposal } from '../../ai/protocol';
import { MARKET_COINS } from '../../services/marketData';

const GREEN = '#12915E';
const usd = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Groups the address so it is easy to verify by eye: 0x1111 1111 … 1111 */
function groupAddr(a: string) {
  return a.replace(/^(0x)(.*)$/, '$1 $2').replace(/(.{4})/g, '$1 ').trim();
}

export default function TransferApprovalCard({
  proposal,
  resolved,
  busy,
  onApprove,
  onReject,
}: {
  proposal: TransferProposal;
  resolved?: ChatMessage['resolved'];
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const [left, setLeft] = useState(Math.max(0, Math.ceil((proposal.expiresAt - Date.now()) / 1000)));

  useEffect(() => {
    if (resolved) return;
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((proposal.expiresAt - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [proposal.expiresAt, resolved]);

  const expired = !resolved && left <= 0;
  const state = resolved ?? (expired ? 'expired' : undefined);
  const coin = MARKET_COINS.find((c) => c.symbol === proposal.symbol);
  const panel = dark ? 'rgba(255,255,255,0.07)' : '#F1F1F5';
  const rule = dark ? 'rgba(255,255,255,0.10)' : 'rgba(6,14,44,0.08)';

  const Row = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
    <View style={styles.row}>
      <Text style={[styles.k, { color: theme.inkMuted }]}>{k}</Text>
      <Text style={[styles.v, { color: theme.ink }, strong && styles.vStrong]} numberOfLines={2}>{v}</Text>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: panel }]}>
      <View style={styles.head}>
        <CoinLogo symbol={proposal.symbol} color={coin?.color ?? '#6C63FF'} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.sendLabel, { color: theme.inkMuted }]}>You are sending</Text>
          <Text style={[styles.amount, { color: theme.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {proposal.amount} {proposal.symbol}
          </Text>
          <Text style={[styles.amountUsd, { color: theme.inkMuted }]}>≈ {usd(proposal.amountUsd)}</Text>
        </View>
      </View>

      <View style={[styles.rule, { backgroundColor: rule }]} />

      <View style={styles.addrBlock}>
        <Text style={[styles.k, { color: theme.inkMuted }]}>To</Text>
        <Text style={[styles.addr, { color: theme.ink }]} selectable>{groupAddr(proposal.toAddress)}</Text>
      </View>
      <Row k="Network" v={proposal.chainName} />
      <Row k="Network fee" v={`~${proposal.feeNative} ${proposal.feeSymbol} (${usd(proposal.feeUsd)})`} />
      <Row k="Total" v={usd(proposal.totalUsd)} strong />

      {proposal.warnings.length > 0 && !state && (
        <View style={[styles.warn, { backgroundColor: dark ? 'rgba(255,170,0,0.12)' : '#FFF4DC' }]}>
          <AlertCircleIcon size={18} color="#B7791F" />
          <Text style={styles.warnText}>{proposal.warnings.join('\n')}</Text>
        </View>
      )}

      {!state && (
        <>
          <View style={styles.btnRow}>
            <Pressable
              onPress={onReject}
              disabled={busy}
              style={({ pressed }) => [styles.btn, styles.btnGhost, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : '#E4E4EA', opacity: pressed ? 0.7 : 1 }]}
            >
              <CloseIcon size={18} color={theme.ink} />
              <Text style={[styles.btnText, { color: theme.ink }]}>Reject</Text>
            </Pressable>
            <Pressable
              onPress={onApprove}
              disabled={busy}
              style={({ pressed }) => [styles.btn, { backgroundColor: GREEN, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <CheckIcon size={18} color="#fff" />}
              <Text style={[styles.btnText, { color: '#fff' }]}>Approve</Text>
            </Pressable>
          </View>
          <Text style={[styles.timer, { color: theme.inkMuted }]}>
            Quote valid for {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}. You will confirm with biometrics or passcode.
          </Text>
        </>
      )}

      {state === 'approved' && <Text style={[styles.status, { color: GREEN }]}>Approved</Text>}
      {state === 'rejected' && <Text style={[styles.status, { color: theme.inkMuted }]}>Rejected. Nothing was sent.</Text>}
      {state === 'expired' && <Text style={[styles.status, { color: theme.inkMuted }]}>Quote expired. Ask me again for a fresh one.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 16, marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sendLabel: { fontSize: 12, fontFamily: 'Inter-500', fontWeight: '500' },
  amount: { fontSize: 22, fontFamily: 'Inter-700', fontWeight: '700', marginTop: 2 },
  amountUsd: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  addrBlock: { marginBottom: 10 },
  addr: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600', marginTop: 4, lineHeight: 21, letterSpacing: 0.2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 5, gap: 16 },
  k: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500' },
  v: { fontSize: 14, fontFamily: 'Inter-600', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  vStrong: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700' },
  warn: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 12, marginTop: 12, alignItems: 'flex-start' },
  warnText: { flex: 1, color: '#8A5A00', fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter-500', fontWeight: '500' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnGhost: {},
  btnText: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700' },
  timer: { fontSize: 12, textAlign: 'center', marginTop: 10, fontFamily: 'Inter-500', fontWeight: '500' },
  status: { fontSize: 14, fontFamily: 'Inter-700', fontWeight: '700', textAlign: 'center', marginTop: 14 },
});
