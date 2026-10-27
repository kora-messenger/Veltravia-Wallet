/**
 * Veltravia Wallet — Settings > Perps menu (Trust parity).
 *
 * A plain list: Hyperliquid, Aster, How perps work?, Contact support.
 *  - Hyperliquid / Aster: open the venue screen (PerpsVenueScreen) with the
 *    venue's mark, "Show in markets" toggle, Aster's asset mode and docs links.
 *  - How perps work?: the educational screen (PerpsAboutScreen).
 *  - Contact support: hands the Veltravia help center to the system browser
 *    (Linking.openURL), deliberately NOT the in-app browser. The help site
 *    itself is a separate build.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon, ChevronRightIcon, ExternalLinkIcon } from '../components/icons';
import { HyperliquidTile, AsterTile } from '../components/PerpsVenueMarks';
import { showToast } from '../components/Toast';

export const SUPPORT_URL = 'https://help.veltraviawallet.com';


export default function PerpsMenuScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const chipBg = dark ? '#1D2133' : '#EEEEF0';

  const contactSupport = () => {
    Linking.openURL(SUPPORT_URL).catch(() => showToast("Couldn't open Support. Try again later.", { kind: 'error' }));
  };

  const Row = ({ label, icon, trailing, onPress }: { label: string; icon?: React.ReactNode; trailing: React.ReactNode; onPress: () => void }) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#F5F5F7' }]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, { color: theme.ink }]}>{label}</Text>
      {trailing}
    </Pressable>
  );

  const chevron = <ChevronRightIcon size={22} color={theme.inkMuted} />;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={12} onPress={() => navigation.goBack()} style={[styles.back, { backgroundColor: chipBg }]}>
          <BackIcon size={22} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Perps</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ marginTop: 6 }}>
        <Row label="Hyperliquid" icon={<HyperliquidTile />} trailing={chevron} onPress={() => navigation.navigate('PerpsVenue', { venue: 'hyperliquid' })} />
        <Row label="Aster" icon={<AsterTile />} trailing={chevron} onPress={() => navigation.navigate('PerpsVenue', { venue: 'aster' })} />
        <Row label="How perps work?" trailing={chevron} onPress={() => navigation.navigate('PerpsAbout')} />
        <Row label="Contact support" trailing={<ExternalLinkIcon size={22} color={theme.inkMuted} />} onPress={contactSupport} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 76, paddingHorizontal: 20 },
  icon: { marginRight: 14 },
  label: { flex: 1, fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
});
