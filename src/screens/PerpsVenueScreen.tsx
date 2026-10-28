/**
 * Veltravia Wallet — Perps venue screen (Trust parity).
 *
 * Opens from Settings > Perps (Hyperliquid / Aster rows). Shows the venue's
 * mark next to the centered title, a "Show in markets" toggle that hides or
 * shows the venue's markets in the Perps lists, Aster's "Asset mode" chooser,
 * and the venue's Fees / Trading rules docs in the in-app browser (Web mode).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeProvider';
import { BackIcon, ChevronRightIcon, ExternalLinkIcon, CheckIcon } from '../components/icons';
import { HyperliquidTile, AsterTile } from '../components/PerpsVenueMarks';
import { openInBrowser } from '../services/browserState';
import {
  useVenuePrefs, setShowInMarkets, setAsterAssetMode,
  type PerpsVenue, type AsterAssetMode,
} from '../services/perpsVenues';

// App violet darkened to Trust's button depth (matches Perps CTAs).
const VIOLET_DEEP = '#5147E6';

const VENUE_INFO: Record<PerpsVenue, {
  name: string;
  feesUrl: string;
  rulesUrl: string;
}> = {
  hyperliquid: {
    name: 'Hyperliquid',
    feesUrl: 'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees',
    rulesUrl: 'https://hyperliquid.gitbook.io/hyperliquid-docs/trading',
  },
  aster: {
    name: 'Aster',
    feesUrl: 'https://docs.asterdex.com/trading/perpetuals/fees-and-specs/fees',
    rulesUrl: 'https://www.asterdex.com/en/futures/trading-rules/trading-rules',
  },
};

const ASSET_MODES: Array<{ key: AsterAssetMode; label: string }> = [
  { key: 'single', label: 'Single-asset mode' },
  { key: 'multi', label: 'Multi-asset mode' },
];

function VenueSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const dark = useTheme().theme.mode === 'dark';
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} onPress={onToggle} hitSlop={8}>
      <View style={[styles.switchTrack, { backgroundColor: on ? VIOLET_DEEP : dark ? '#2A2F45' : '#D7D7DC' }]}>
        <View style={[styles.switchThumb, on && styles.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

export default function PerpsVenueScreen() {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const venue: PerpsVenue = route?.params?.venue ?? 'hyperliquid';
  const info = VENUE_INFO[venue];
  const prefs = useVenuePrefs(venue);
  const [modeOpen, setModeOpen] = useState(false);

  const chipBg = dark ? '#1D2133' : '#EEEEF0';
  const divider = dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';
  const Mark = venue === 'aster' ? AsterTile : HyperliquidTile;

  const openDocs = (url: string) => openInBrowser(url);

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={12} onPress={() => navigation.goBack()} style={[styles.back, { backgroundColor: chipBg }]}>
          <BackIcon size={22} color={theme.ink} />
        </Pressable>
        <View style={styles.headerTitle}>
          <Mark size={22} />
          <Text style={[styles.title, { color: theme.ink }]}>{info.name}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Show in markets */}
        <View style={[styles.row, { borderBottomColor: divider, borderBottomWidth: 1 }]}>
          <Text style={[styles.rowLabel, { color: theme.ink }]}>Show in markets</Text>
          <VenueSwitch on={prefs.showInMarkets} onToggle={() => setShowInMarkets(venue, !prefs.showInMarkets)} />
        </View>

        {/* Asset mode (Aster only) */}
        {venue === 'aster' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setModeOpen(true)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#F5F5F7' }]}
          >
            <View style={styles.rowStack}>
              <Text style={[styles.rowLabel, { color: theme.ink }]}>Asset mode</Text>
              <Text style={[styles.rowSub, { color: theme.inkMuted }]}>
                {prefs.assetMode === 'multi' ? 'Multi-asset mode' : 'Single-asset mode'}
              </Text>
            </View>
            <ChevronRightIcon size={22} color={theme.inkMuted} />
          </Pressable>
        ) : null}

        {/* Docs links */}
        <Pressable
          accessibilityRole="button"
          onPress={() => openDocs(info.feesUrl)}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#F5F5F7' }]}
        >
          <Text style={[styles.rowLabel, { color: theme.ink }]}>Fees</Text>
          <ExternalLinkIcon size={22} color={theme.inkMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => openDocs(info.rulesUrl)}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#F5F5F7' }]}
        >
          <Text style={[styles.rowLabel, { color: theme.ink }]}>Trading rules</Text>
          <ExternalLinkIcon size={22} color={theme.inkMuted} />
        </Pressable>
      </ScrollView>

      {/* Asset mode chooser */}
      <Modal visible={modeOpen} transparent animationType="slide" onRequestClose={() => setModeOpen(false)}>
        <Pressable style={styles.sheetScrim} onPress={() => setModeOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={[styles.sheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.sheetBar, { backgroundColor: dark ? '#2A2F45' : '#E3E3E8' }]} />
            {ASSET_MODES.map((m) => (
              <Pressable
                key={m.key}
                accessibilityRole="button"
                onPress={() => { setAsterAssetMode(m.key); setModeOpen(false); }}
                style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : '#F5F5F7' }]}
              >
                <Text style={[styles.sheetRowLabel, { color: theme.ink }]}>{m.label}</Text>
                {(prefs.assetMode ?? 'single') === m.key ? <CheckIcon size={22} color={VIOLET_DEEP} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontFamily: 'Inter-700', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 68, paddingHorizontal: 20 },
  rowStack: { flex: 1, gap: 3 },
  rowLabel: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
  rowSub: { fontSize: 13, fontFamily: 'Inter-500', fontWeight: '500' },
  switchTrack: { width: 51, height: 31, borderRadius: 16, padding: 2, justifyContent: 'center' },
  switchThumb: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#FFFFFF' },
  switchThumbOn: { alignSelf: 'flex-end' },
  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 28 },
  sheetBar: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 10, marginBottom: 6 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 58, paddingHorizontal: 20 },
  sheetRowLabel: { fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600' },
});
