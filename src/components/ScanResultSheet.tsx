/**
 * "Scanned code" bottom sheet — Trust's `pay_invalid_qr_bottomsheet_viewed`
 * pattern, generalised: it is the screen shown when a QR was read but nobody
 * was waiting for it (the home scan button), or when the code is not something
 * a wallet can act on.
 *
 *   [X]            Scanned code
 *   ┌──────────────────────────────┐
 *   │  Wallet address              │   <- what the parser decided it is
 *   │  0x9b21…7e8F                 │
 *   │  Ethereum                    │
 *   └──────────────────────────────┘
 *   [        Copy address        ]     <- primary, only for actionable codes
 *   [          Scan again        ]
 *
 * An unrecognisable code gets the same sheet with a short explanation instead of
 * a toast, so the reason stays on screen while the user decides.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppModal from './AppModal';
import { CloseIcon } from './icons';
import { useTheme } from '../theme/ThemeProvider';
import { type ParsedQr, isActionable } from '../services/qrParse';

interface Props {
  visible: boolean;
  parsed: ParsedQr | null;
  onClose: () => void;
  onPrimary?: () => void;
  onRescan?: () => void;
}

const BTN = '#392EFA';

export default function ScanResultSheet({ visible, parsed, onClose, onPrimary, onRescan }: Props) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const insets = useSafeAreaInsets();
  if (!parsed) return null;

  const actionable = isActionable(parsed);
  const cardBg = dark ? '#1C2033' : '#F5F5F7';
  const muted = theme.inkMuted;
  const primaryLabel =
    parsed.kind === 'walletconnect' ? 'Connect'
      : parsed.kind === 'url' ? 'Open link'
        : parsed.kind === 'payment' || parsed.kind === 'asset' ? 'Send'
          : 'Copy address';

  return (
    <AppModal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.scrim, { backgroundColor: dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.21)' }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: dark ? theme.surface : '#FFFFFF', paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[styles.handle, { backgroundColor: dark ? '#3A3E5C' : '#E4E4E9' }]} />
        <View style={styles.header}>
          <Pressable accessibilityLabel="Close scanned code" onPress={onClose} style={[styles.circle, { backgroundColor: dark ? '#232640' : '#F0F0F2' }]}>
            <CloseIcon size={18} color={theme.ink} />
          </Pressable>
          <View style={styles.titleWrap} pointerEvents="none">
            <Text style={[styles.title, { color: theme.ink }]}>{actionable ? 'Scanned code' : 'Unrecognised code'}</Text>
          </View>
          <View style={styles.circle} />
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.kind, { color: theme.ink }]} accessibilityLabel={`Code type ${parsed.label}`}>{parsed.label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
            <Text testID="scanResultValue" style={[styles.value, { color: theme.ink }]} numberOfLines={1}>{parsed.value}</Text>
          </ScrollView>
          {!!parsed.detail && (
            <Text style={[styles.detail, { color: muted }]}>{parsed.detail}</Text>
          )}
        </View>

        {actionable ? (
          <Pressable
            accessibilityLabel={primaryLabel}
            onPress={onPrimary}
            style={({ pressed }) => [styles.primary, { backgroundColor: BTN, opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [styles.primary, { backgroundColor: BTN, opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={styles.primaryText}>Close</Text>
          </Pressable>
        )}

        <Pressable accessibilityLabel="Scan again" onPress={onRescan ?? onClose} style={styles.secondary}>
          <Text style={[styles.secondaryText, { color: theme.ink }]}>Scan again</Text>
        </Pressable>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 10 },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  circle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  title: { fontSize: 17, fontFamily: 'Inter-700', fontWeight: '700' },
  card: { borderRadius: 16, padding: 16, marginBottom: 16 },
  kind: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
  value: { fontSize: 14, fontFamily: 'Inter-500', fontWeight: '500', marginTop: 6 },
  detail: { fontSize: 13, fontFamily: 'Inter-400', marginTop: 6 },
  primary: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },
  secondary: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
});
