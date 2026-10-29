/**
 * Veltravia Wallet — the pairing code sheet.
 *
 * Shown on the device that already has the wallet (Manage account, and
 * Settings → Paired devices). The other device scans it from the recovery
 * screen or from Settings → Paired devices, and both then share one wallet
 * lock.
 *
 * The code carries the wallet-group id, the group key and the current device
 * list. It never carries the recovery phrase, and it is read camera-to-camera,
 * so nothing about the pairing passes through a server. It expires: a stale
 * screenshot is worthless after PAIRING_TTL_MS.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import QrCode from './QrCode';
import AppModal from './AppModal';
import { buildPairingPayload, ensureGroup, getGroup, PAIRING_TTL_MS } from '../core/security/walletGroup';

function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function PairingCodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [expires, setExpires] = useState(0);
  const [now, setNow] = useState(Date.now());

  const mint = useCallback(async () => {
    await ensureGroup();
    const group = await getGroup();
    if (!group) {
      setUri(null);
      return;
    }
    const ttl = Date.now() + PAIRING_TTL_MS;
    setUri(buildPairingPayload(group));
    setExpires(ttl);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (visible) mint();
    else setUri(null);
  }, [visible, mint]);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  const expired = !!uri && expires - now <= 0;

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]} testID="pairingCodeSheet">
          <Text style={[styles.title, { color: theme.ink }]}>Pair a device</Text>
          <Text style={[styles.sub, { color: theme.inkMuted }]}>
            On the other device open Veltravia Wallet → Import an existing wallet → Pair device, then scan this code.
          </Text>

          <View style={styles.qrWrap}>
            {uri ? (
              <>
                <QrCode value={uri} size={210} />
                <Text style={[styles.timer, { color: theme.inkMuted }]} testID="pairingTimer">
                  {expired ? 'Code expired' : `Expires in ${mmss(expires - now)}`}
                </Text>
              </>
            ) : (
              <Text style={[styles.sub, { color: theme.inkMuted }]}>Preparing this wallet's code…</Text>
            )}
          </View>

          <Text style={[styles.fine, { color: theme.inkMuted }]}>
            This code never contains your recovery phrase. It shares this wallet's lock, and it only works once.
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={mint}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.8 : 1 },
              ]}
              accessibilityLabel="Show a new code"
            >
              <Text style={[styles.btnText, { color: theme.ink }]}>New code</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.btn, { backgroundColor: theme.brand, opacity: pressed ? 0.85 : 1 }]}
              accessibilityLabel="Done"
            >
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 20, padding: 20, gap: 12 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  qrWrap: { alignItems: 'center', gap: 8, paddingVertical: 6 },
  timer: { fontSize: 12.5 },
  fine: { fontSize: 11.5, lineHeight: 16, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  btn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
});
