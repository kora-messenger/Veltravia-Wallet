/**
 * Veltravia Wallet — Address Book (Settings > Address Book).
 * Saved recipients (name + address), persisted in the encrypted settings
 * store. v1: add, list, delete, tap to copy.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon, PlusIcon, TrashIcon } from '../components/icons';
import AppModal from '../components/AppModal';
import { readSettings, writeSettings } from '../core/storage/secureStorage';
import { showToast } from '../components/Toast';

interface Contact { id: string; name: string; address: string; }

const isProbablyAddress = (a: string) => a.trim().length >= 20 && /^0x[a-fA-F0-9]+$|^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$|^T[A-Za-z0-9]{25,}$/.test(a.trim());

export default function AddressBookScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    (async () => {
      const s = await readSettings();
      setContacts(Array.isArray(s.contacts) ? s.contacts : []);
    })();
  }, []);

  const save = async () => {
    const n = name.trim(); const a = address.trim();
    if (!n) { showToast('Enter a name', { kind: 'error' }); return; }
    if (!isProbablyAddress(a)) { showToast('That address does not look valid', { kind: 'error' }); return; }
    const next = [...contacts, { id: `${Date.now()}`, name: n, address: a }];
    setContacts(next);
    await writeSettings({ contacts: next });
    setName(''); setAddress(''); setAddOpen(false);
    showToast('Contact saved', { kind: 'success' });
  };

  const remove = async (id: string) => {
    const next = contacts.filter((c) => c.id !== id);
    setContacts(next);
    await writeSettings({ contacts: next });
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Address Book</Text>
        <Pressable hitSlop={12} onPress={() => setAddOpen(true)}>
          <PlusIcon size={24} color={theme.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {contacts.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: theme.ink }]}>No saved addresses</Text>
            <Text style={[styles.emptySub, { color: theme.inkMuted }]}>
              Save the addresses you send to often and they will be one tap away when you send.
            </Text>
          </View>
        )}
        {contacts.map((c) => (
          <View key={c.id} style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.ink }]}>{c.name}</Text>
              <Text numberOfLines={1} style={[styles.addr, { color: theme.inkMuted }]}>{c.address}</Text>
            </View>
            <Pressable hitSlop={12} onPress={() => remove(c.id)}>
              <TrashIcon size={20} color={theme.inkMuted} />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <AppModal visible={addOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setAddOpen(false)}>
        <Pressable style={[styles.dim, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(30,32,48,0.12)' }]} onPress={() => setAddOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: isDark ? theme.surfaceAlt : '#FFFFFF' }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: theme.ink }]}>Save an address</Text>
            <TextInput
              placeholder="Name"
              placeholderTextColor={theme.inkMuted}
              value={name}
              onChangeText={setName}
              style={[styles.input, { color: theme.ink, borderColor: theme.ink, opacity: 1 }]}
            />
            <TextInput
              placeholder="Wallet address"
              placeholderTextColor={theme.inkMuted}
              value={address}
              onChangeText={setAddress}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              style={[styles.input, { color: theme.ink, borderColor: theme.ink, opacity: 1 }]}
            />
            <Pressable style={[styles.saveBtn, { backgroundColor: theme.brand }]} onPress={save}>
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </AppModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
  content: { padding: 16, paddingBottom: 120 },
  empty: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 120 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter-600', fontWeight: '600', marginBottom: 8 },
  emptySub: { fontSize: 13, fontFamily: 'Inter-400', lineHeight: 19, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 10, gap: 12 },
  name: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  addr: { fontSize: 12, fontFamily: 'Inter-400', marginTop: 2 },
  dim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 40 },
  sheetTitle: { fontSize: 20, fontFamily: 'Inter-700', fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, fontFamily: 'Inter-400' },
  saveBtn: { borderRadius: 12, alignItems: 'center', paddingVertical: 15, marginTop: 6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
});
