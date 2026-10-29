/**
 * Veltravia Wallet — Settings tab (Trust-style flat grouped list).
 *
 * Layout measured from Trust (1080px frames): 68dp rows, near-black line
 * icons ~24dp, 16sp medium labels, thin full-width dividers, no chevrons.
 * EVERY row connects to something real — no dead ends.
 *
 * Groups:
 *   1  Address Book · Security · Wallet Lock · Notifications · Preferences · Perps
 *   2  community: X · Telegram · YouTube · TikTok  (NO Reddit / Instagram / Facebook — standing rule)
 *   3  About (Terms / Privacy via the in-app browser)
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import {
  ShieldLockIcon, AddressBookIcon, BellIcon, SlidersIcon, PerpsIcon,
  InfoCircleIcon, XIcon, TelegramIcon, YouTubeIcon, TikTokIcon, CheckIcon, BackIcon,
} from '../components/icons';
import AppModal from '../components/AppModal';
import WalletLockSheet from './wallet/WalletLockSheet';
import { getBiometryType, isBiometricUnlockEnabled, setBiometricUnlockEnabled, type BiometryType } from '../core/security/biometrics';
import { readSettings, writeSettings } from '../core/storage/secureStorage';
import { openInBrowser } from '../services/browserState';

const APP_VERSION = '1.0';
const LEGAL = { terms: 'https://veltraviawallet.com/terms', privacy: 'https://veltraviawallet.com/privacy' };
const SOCIAL = {
  x: 'https://x.com/veltravia',
  telegram: 'https://t.me/veltravia',
  youtube: 'https://youtube.com/@veltravia',
  tiktok: 'https://tiktok.com/@veltravia',
};
const CURRENCIES = ['USD', 'NGN', 'EUR', 'GBP'];

type Sheet = null | 'security' | 'notifications' | 'preferences' | 'currency' | 'about';

const BIOMETRY_NAME: Record<BiometryType, string> = {
  faceId: 'Face recognition',
  touchId: 'Fingerprint',
  other: 'Biometrics',
  none: 'None',
};

/** Bottom card sheet (same pattern as the lock sheet). */
function CardSheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { theme, isDark } = useTheme();
  return (
    <AppModal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable
        style={[styles.dim, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(30,32,48,0.12)' }]}
        onPress={onClose}
      >
        <Pressable style={[styles.card, { backgroundColor: isDark ? theme.surfaceAlt : '#FFFFFF' }]} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.cardTitle, { color: theme.ink }]}>{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

export default function SettingsScreen() {
  const { theme, setOverride, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [lockSheet, setLockSheet] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  // Security (real state)
  const [biometry, setBiometry] = useState<BiometryType>('none');
  const [bioEnabled, setBioEnabled] = useState(false);
  useEffect(() => {
    (async () => {
      setBiometry(await getBiometryType());
      setBioEnabled(await isBiometricUnlockEnabled());
    })();
  }, []);
  const toggleBio = async (on: boolean) => {
    await setBiometricUnlockEnabled(on);
    setBioEnabled(await isBiometricUnlockEnabled());
  };

  // Currency + notifications (persisted)
  const [currency, setCurrency] = useState('USD');
  const [alerts, setAlerts] = useState(true);
  useEffect(() => {
    (async () => {
      const s = await readSettings();
      if (typeof s.currency === 'string') setCurrency(s.currency);
      if (typeof s.notifications === 'boolean') setAlerts(s.notifications);
    })();
  }, []);
  const pickCurrency = async (c: string) => {
    setCurrency(c);
    await writeSettings({ currency: c });
  };
  const toggleAlerts = async (on: boolean) => {
    setAlerts(on);
    await writeSettings({ notifications: on });
  };

  const Divider = () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.ink, opacity: 0.06, marginVertical: 10 }} />;

  const Row = ({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) => (
    <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.5 }]} onPress={onPress}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={[styles.rowLabel, { color: theme.ink }]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()}>
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.ink }]}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ---- group 1: wallet & app ---- */}
        <Row icon={<AddressBookIcon size={24} color={theme.ink} />} label="Address Book" onPress={() => navigation.navigate('AddressBook')} />
        <Row icon={<ShieldLockIcon size={24} color={theme.ink} />} label="Security" onPress={() => setSheet('security')} />
        <Row icon={<ShieldLockIcon size={24} color={theme.ink} />} label="Wallet Lock" onPress={() => setLockSheet(true)} />
        <Row icon={<BellIcon size={24} color={theme.ink} />} label="Notifications" onPress={() => setSheet('notifications')} />
        <Row icon={<SlidersIcon size={24} color={theme.ink} />} label="Preferences" onPress={() => setSheet('preferences')} />
        <Row icon={<PerpsIcon size={24} color={theme.ink} />} label="Perps" onPress={() => navigation.navigate('PerpsMenu')} />

        <Divider />

        {/* ---- group 2: community ---- */}
        <Row icon={<XIcon size={22} color={theme.ink} />} label="X" onPress={() => openInBrowser(SOCIAL.x)} />
        <Row icon={<TelegramIcon size={22} color={theme.ink} />} label="Telegram" onPress={() => openInBrowser(SOCIAL.telegram)} />
        <Row icon={<YouTubeIcon size={22} color={theme.ink} />} label="YouTube" onPress={() => openInBrowser(SOCIAL.youtube)} />
        <Row icon={<TikTokIcon size={22} color={theme.ink} />} label="TikTok" onPress={() => openInBrowser(SOCIAL.tiktok)} />

        <Divider />

        {/* ---- group 3: about ---- */}
        <Row icon={<InfoCircleIcon size={24} color={theme.ink} />} label="About" onPress={() => setSheet('about')} />
      </ScrollView>

      <WalletLockSheet visible={lockSheet} onClose={() => setLockSheet(false)} />

      {/* ---- Security ---- */}
      <CardSheet visible={sheet === 'security'} title="Security" onClose={() => setSheet(null)}>
        <Text style={[styles.cardSub, { color: theme.inkMuted }]}>
          Your passcode is set. Biometrics unlock the app using this device's sensor — Veltravia never stores fingerprints.
        </Text>
        <View style={styles.sheetRow}>
          <Text style={[styles.rowLabel, { color: theme.ink }]}>{BIOMETRY_NAME[biometry]}</Text>
          <Switch value={bioEnabled} disabled={biometry === 'none'} onValueChange={toggleBio} trackColor={{ true: theme.brand, false: theme.inkMuted }} />
        </View>
        {biometry === 'none' && (
          <Text style={[styles.cardSub, { color: theme.inkMuted }]}>No biometric sensor found on this device.</Text>
        )}
        <View style={styles.sheetRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: theme.ink }]}>Paired devices</Text>
            <Text style={[styles.rowDetail, { color: theme.inkMuted }]}>
              Devices that share this wallet's lock
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setSheet(null);
              navigation.navigate('Devices');
            }}
            hitSlop={8}
            accessibilityLabel="Paired devices"
          >
            <Text style={{ color: theme.brand, fontWeight: '600' }}>Manage</Text>
          </Pressable>
        </View>
      </CardSheet>

      {/* ---- Notifications ---- */}
      <CardSheet visible={sheet === 'notifications'} title="Notifications" onClose={() => setSheet(null)}>
        <View style={styles.sheetRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: theme.ink }]}>Transfers and market alerts</Text>
            <Text style={[styles.rowDetail, { color: theme.inkMuted }]}>
              {alerts ? 'On' : 'Off'} — keeps you updated on your transactions
            </Text>
          </View>
          <Switch value={alerts} onValueChange={toggleAlerts} trackColor={{ true: theme.brand, false: theme.inkMuted }} />
        </View>
      </CardSheet>

      {/* ---- Preferences (appearance + currency) ---- */}
      <CardSheet visible={sheet === 'preferences'} title="Preferences" onClose={() => setSheet(null)}>
        <View style={styles.sheetRow}>
          <Text style={[styles.rowLabel, { color: theme.ink }]}>Appearance</Text>
          <Pressable
            style={[styles.themeChip, { backgroundColor: theme.brand }]}
            onPress={() => setOverride(isDark ? 'light' : 'dark')}
          >
            <Text style={styles.themeChipText}>{isDark ? 'Dark' : 'Light'}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.sheetRow} onPress={() => setSheet('currency')}>
          <Text style={[styles.rowLabel, { color: theme.ink }]}>Currency</Text>
          <Text style={[styles.rowDetail, { color: theme.inkMuted }]}>{currency}</Text>
        </Pressable>
      </CardSheet>

      {/* ---- Currency ---- */}
      <CardSheet visible={sheet === 'currency'} title="Currency" onClose={() => setSheet(null)}>
        <Text style={[styles.cardSub, { color: theme.inkMuted }]}>Shown for balances and prices.</Text>
        {CURRENCIES.map((c) => (
          <Pressable key={c} style={styles.sheetRow} onPress={() => pickCurrency(c)}>
            <Text style={[styles.rowLabel, { color: theme.ink }]}>{c}</Text>
            {currency === c && <CheckIcon size={18} color={theme.brand} />}
          </Pressable>
        ))}
      </CardSheet>

      {/* ---- About ---- */}
      <CardSheet visible={sheet === 'about'} title="About" onClose={() => setSheet(null)}>
        <Text style={[styles.rowLabel, { color: theme.ink }]}>Veltravia Wallet</Text>
        <Text style={[styles.cardSub, { color: theme.inkMuted }]}>Version {APP_VERSION}</Text>
        <Pressable style={styles.sheetRow} onPress={() => openInBrowser(LEGAL.terms)}>
          <Text style={[styles.rowLabel, { color: theme.brand }]}>Terms of Use</Text>
        </Pressable>
        <Pressable style={styles.sheetRow} onPress={() => openInBrowser(LEGAL.privacy)}>
          <Text style={[styles.rowLabel, { color: theme.brand }]}>Privacy Policy</Text>
        </Pressable>
      </CardSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 140 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 10 : 4, paddingBottom: 8 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', height: 68 },
  rowIcon: { width: 40, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 16, fontFamily: 'Inter-500', fontWeight: '500', marginLeft: 8 },
  rowDetail: { fontSize: 12, marginTop: 2, fontFamily: 'Inter-400' },
  dim: { flex: 1, justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 40 },
  cardTitle: { fontSize: 20, fontFamily: 'Inter-700', fontWeight: '700', marginBottom: 10 },
  cardSub: { fontSize: 13, fontFamily: 'Inter-400', lineHeight: 19, marginBottom: 12 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  themeChip: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  themeChipText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter-600', fontWeight: '600' },
});
