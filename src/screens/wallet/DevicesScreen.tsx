/**
 * Veltravia Wallet — Settings → Paired devices.
 *
 * "This wallet is on these devices." A wallet group is created with the wallet
 * and joined only by scanning a short-lived code from an EXISTING device, which
 * is why a copied recovery phrase cannot quietly add a phone to the list: the
 * seed is a root credential that only ever acts locally.
 *
 * Every device in the group sees the same lock state. Removing one rotates the
 * group key, so a removed phone cannot read anything published afterwards.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import PairingCodeSheet from '../../components/PairingCodeSheet';
import { showToast } from '../../components/Toast';
import { deviceId, ensureGroup, getGroup, groupRemoved, revokeDevice, type WalletGroup } from '../../core/security/walletGroup';
import { publishLockState } from '../../core/security/lockRegistry';
import { walletLocked } from '../../core/security/walletLock';

export default function DevicesScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = useState<WalletGroup | null>(null);
  const [ownId, setOwnId] = useState<string>('');
  const [pairingOpen, setPairingOpen] = useState(false);
  const [removed, setRemoved] = useState(false);

  const load = useCallback(async () => {
    await ensureGroup();
    setGroup(await getGroup());
    setOwnId(await deviceId());
    setRemoved(groupRemoved());
  }, []);

  useEffect(() => {
    load();
  }, [load]);


  const remove = (id: string, name: string) => {
    Alert.alert(
      'Remove this device?',
      `${name} will lose this wallet's lock state and will have to pair again. Removing it does not delete the recovery phrase it already stored, so its funds access stays until you move the wallet to a new phrase.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const next = await revokeDevice(id);
            setGroup(next);
            // Announce the rotation straight away so the remaining devices pick
            // up the new key, and the removed one learns it is out.
            await publishLockState(await walletLocked());
            showToast('Device removed', { kind: 'success' });
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Back">
          <Text style={[styles.back, { color: theme.ink }]}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Paired devices</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 16 }}>
        <Text style={[styles.lead, { color: theme.inkMuted }]}>
          Every device in this list shares one wallet lock. Lock it on one device and the others refuse to send,
          swap or trade until it is unlocked from any of them.
        </Text>
        <Text style={[styles.fine, { color: theme.inkMuted }]}>
          Recovering this wallet with your recovery phrase adds that device automatically. Use a pairing code to add
          a device without typing the phrase.
        </Text>

        {removed && (
          <View style={[styles.card, styles.removedCard, { borderColor: theme.negative }]} testID="removedNotice">
            <Text style={[styles.removedTitle, { color: theme.negative }]}>This device was removed</Text>
            <Text style={[styles.fine, { color: theme.inkMuted }]}>
              It no longer shares this wallet's lock. Pair it again from an authorised device to restore the shared
              lock; until then it keeps its own local lock.
            </Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {(group?.devices ?? []).map((d) => (
            <View key={d.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.ink }]}>{d.name}</Text>
                <Text style={[styles.meta, { color: theme.inkMuted }]}>
                  {d.id === ownId ? 'This device' : `Paired ${new Date(d.addedAt).toLocaleDateString()}`}
                </Text>
              </View>
              {d.id === ownId ? (
                <Text style={[styles.badge, { color: theme.brand }]}>Current</Text>
              ) : (
                <Pressable onPress={() => remove(d.id, d.name)} hitSlop={8}>
                  <Text style={[styles.remove, { color: theme.negative }]}>Remove</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => setPairingOpen(true)}
          style={[styles.action, { backgroundColor: theme.brand }]}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>Pair a new device</Text>
        </Pressable>

        <Text style={[styles.fine, { color: theme.inkMuted }]}>
          Pairing sends your recovery phrase to the new device so it becomes a full wallet of its own. It travels
          sealed to a one-time key that device generates seconds earlier and throws away when pairing ends, so the
          relay carries ciphertext it cannot open. Lock state stays encrypted the same way — our servers cannot read
          it, or your device names.
        </Text>
        <Text style={[styles.fine, { color: theme.inkMuted }]}>
          Lock state and your lock password come with the wallet: a phone paired while this wallet is locked
          arrives locked, opened by the same password. Fingerprints and face unlock do not travel, because they
          belong to each phone.
          Removing a device rotates the lock key, so that phone stops reading lock state and has to pair again. It
          cannot take back the phrase it already holds: a removed device can still move funds, exactly like any copy
          of your recovery phrase. If you lost a phone or think it was compromised, move the wallet to a new phrase
          and abandon the old one. This list is a lock between your devices, not a lock on the blockchain.
        </Text>
      </ScrollView>

      <PairingCodeSheet visible={pairingOpen} onClose={() => setPairingOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  removedCard: { borderWidth: 1, padding: 14, gap: 6 },
  removedTitle: { fontSize: 14.5, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  back: { fontSize: 28, lineHeight: 30 },
  title: { fontSize: 17, fontWeight: '600' },
  lead: { fontSize: 14, lineHeight: 20 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
  badge: { fontSize: 12, fontWeight: '600' },
  remove: { fontSize: 13, fontWeight: '600' },
  action: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12.5, textAlign: 'center', lineHeight: 18 },
  fine: { fontSize: 12, lineHeight: 17 },
});
