/**
 * "Pay with" bottom sheet (Trust). Measured: sheet top y568 (411x913 dp),
 * centered 18dp bold title with a currency dropdown chip on the right,
 * rows 77dp pitch with a 48dp round avatar + 16dp name. Rows are providers
 * that qualify for the current amount; the current one is checked.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { ChevronDownIcon } from '../../components/icons';
import { Provider } from './providers';
import { ProviderMark } from './ProviderMark';
import { Flag } from './Flag';

export default function PayWithSheet({
  visible,
  providers,
  selectedId,
  fiat,
  fiatFlag,
  onPick,
  onClose,
}: {
  visible: boolean;
  providers: Provider[];
  selectedId: string | null;
  fiat: string;
  fiatFlag: string | null;
  onPick: (p: Provider) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const H = Dimensions.get('window').height;
  const y = useRef(new Animated.Value(H)).current;
  const dim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(dim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, y, dim]);

  const close = () => {
    Animated.parallel([
      Animated.timing(y, { toValue: H, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(dim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(onClose);
  };

  const chipBg = theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : '#EFEFF3';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[styles.scrim, { opacity: dim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY: y }] },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.ink }]}>Pay with</Text>
          <View style={[styles.chip, { backgroundColor: chipBg }]}>
            <Flag code={fiatFlag} size={20} />
            <Text style={[styles.chipText, { color: theme.ink }]}>{fiat}</Text>
            <ChevronDownIcon size={16} color={theme.inkMuted} />
          </View>
        </View>
        {providers.map((p) => (
          <Pressable
            key={p.id}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => {
              onPick(p);
              close();
            }}
          >
            <ProviderMark provider={p} size={48} />
            <Text style={[styles.name, { color: theme.ink }]}>{p.name}</Text>
            {p.id === selectedId ? <View style={[styles.dot, { backgroundColor: theme.ink }]} /> : null}
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.18)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 22 },
  header: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontSize: 19, lineHeight: 26, fontFamily: 'Inter-700', fontWeight: '700' },
  chip: { position: 'absolute', right: 22, height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  chipText: { fontSize: 15, fontFamily: 'Inter-700', fontWeight: '700' },
  row: { height: 77, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 18 },
  name: { flex: 1, fontSize: 18, lineHeight: 24, fontFamily: 'Inter-600', fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
