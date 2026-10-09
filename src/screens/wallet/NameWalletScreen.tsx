/**
 * Veltravia Wallet — "Name your wallet" screen (Trust-style, pixel-matched
 * to the reference recording: swipeable colour-circle row with the selected
 * circle enlarged, name field with counter + clear, 5x4 monochrome icon
 * grid, Continue above the keyboard, brief loading, then the wallet is
 * created and switched to).
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeProvider';
import { useWallets } from '../../wallets/WalletsProvider';
import { BackIcon, CloseIcon } from '../../components/icons';
import LinearGradient from 'react-native-linear-gradient';
import { WalletAvatar } from '../../wallets/WalletAvatar';
import {
  WALLET_GLYPHS,
  LogoColorGlyph,
  WALLET_COLORS,
  WALLET_GRADIENTS,
  GLYPH_ORDER,
  COLOR_ORDER,
  WalletGlyphKey,
  WalletColorKey,
} from '../../wallets/WalletGlyphs';

const NAME_LIMIT = 24;

export default function NameWalletScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params?: { origin?: 'created' | 'imported' } };
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { nextWalletName, createWallet } = useWallets();

  const [name, setName] = useState(nextWalletName);
  const [icon, setIcon] = useState<WalletGlyphKey>('veltravia');
  const [color, setColor] = useState<WalletColorKey>('original');
  const [creating, setCreating] = useState(false);

  const origin = route.params?.origin === 'imported' ? 'imported' : 'created';
  const surface = theme.mode === 'dark' ? theme.surfaceAlt : theme.surface;
  const PreviewGlyph = useMemo(() => WALLET_GLYPHS[icon], [icon]);

  const handleContinue = () => {
    if (creating) return;
    setCreating(true);
    // Trust-style beat: brief loading while the account is set up.
    setTimeout(() => {
      createWallet(name, icon, color, origin);
      // Back to Home (Wallets screen is also popped since Home is a tab).
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }, 900);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* ---------- Header ---------- */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()} style={[styles.backBtn]}>
          <BackIcon size={24} color={theme.ink} />
        </Pressable>
        <Text style={[styles.title, { color: theme.ink }]}>Name your wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* ---------- Colour circle picker (swipeable row) ---------- */}
          <View>
            <View style={styles.previewWrap} pointerEvents="none">
              <WalletAvatar icon={icon} color={color} size={96} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.colorRow, { width: Math.max(COLOR_ORDER.length * 66, 340) }]}
            >
              {COLOR_ORDER.map((c) => {
                const selected = c === color;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={[styles.colorTouch, { width: selected ? 84 : 66 }]}
                  >
                    <LinearGradient
                      colors={WALLET_GRADIENTS[c]}
                      start={{ x: 0.15, y: 0 }}
                      end={{ x: 0.85, y: 1 }}
                      style={[
                        styles.colorCircle,
                        c === 'original' && styles.originalCircle,
                        {
                          width: selected ? 40 : 28,
                          height: selected ? 40 : 28,
                          borderRadius: selected ? 20 : 14,
                        },
                        selected && styles.colorSelected,
                      ]}
                    >
                      {c === 'original' ? (
                        <LogoColorGlyph size={selected ? 38 : 28} />
                      ) : (
                        selected && WALLET_GLYPHS[icon] && (
                          <>{React.createElement(WALLET_GLYPHS[icon], { size: 20, color: 'rgba(255,255,255,0.96)' })}</>
                        )
                      )}
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* ---------- Name field ---------- */}
          <View style={[styles.field, { backgroundColor: surface, borderColor: theme.border }]}>
            <TextInput
              value={name}
              onChangeText={(t) => setName(t.slice(0, NAME_LIMIT))}
              placeholder="Wallet name"
              placeholderTextColor={theme.inkMuted}
              style={[styles.input, { color: theme.ink }]}
              returnKeyType="done"
            />
            {name.length > 0 && (
              <Pressable hitSlop={8} onPress={() => setName('')} style={styles.clear}>
                <CloseIcon size={14} color={theme.inkMuted} strokeWidth={2.4} />
              </Pressable>
            )}
            <Text style={[styles.counter, { color: theme.inkMuted }]}>
              {name.length}/{NAME_LIMIT}
            </Text>
          </View>

          {/* ---------- Icon grid: 5 columns x 4 rows ---------- */}
          <View style={styles.grid}>
            {GLYPH_ORDER.map((g) => {
              const Glyph = WALLET_GLYPHS[g];
              const selected = g === icon;
              return (
                <Pressable key={g} onPress={() => setIcon(g)} style={styles.gridTouch}>
                  <View
                    style={[
                      styles.gridTile,
                      {
                        backgroundColor:
                          selected && !(g === 'veltravia' && color === 'original') ? WALLET_GRADIENTS[color][1] : 'transparent',
                      },
                    ]}
                  >
                    {g === 'veltravia' && (!selected || color === 'original') ? (
                      <LogoColorGlyph size={32} />
                    ) : (
                      <Glyph size={26} color={selected ? 'rgba(255,255,255,0.96)' : theme.ink} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* ---------- Continue (rises above the keyboard) ---------- */}
        <View style={{ paddingBottom: insets.bottom + 12, paddingHorizontal: 20 }}>
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              { backgroundColor: theme.brandGradient[0], opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleContinue}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.continueText}>Continue</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ---------- Loading overlay ---------- */}
      {creating && (
        <View style={styles.loading}>
          <View style={[styles.loadingCard, { backgroundColor: surface }]}>
            <ActivityIndicator color={theme.brandGradient[0]} size="large" />
            <Text style={[styles.loadingText, { color: theme.ink }]}>Creating wallet</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600', letterSpacing: -0.2 },

  body: { paddingHorizontal: 20, paddingBottom: 24 },

  previewWrap: { alignItems: 'center', marginTop: 4, marginBottom: 14 },
  preview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  colorRow: { alignItems: 'center', justifyContent: 'center', paddingBottom: 6 },
  colorTouch: { alignItems: 'center', justifyContent: 'center' },
  colorCircle: { alignItems: 'center', justifyContent: 'center' },
  originalCircle: { borderWidth: 1.4, borderColor: 'rgba(140,146,170,0.55)' },
  colorSelected: {
    shadowColor: '#6C63FF',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.4,
    paddingHorizontal: 14,
    height: 54,
    marginTop: 18,
    marginBottom: 22,
  },
  input: { flex: 1, fontSize: 16, fontFamily: 'Inter-600', fontWeight: '600', paddingVertical: 0 },
  clear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(140,146,170,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  counter: { fontSize: 12, fontFamily: 'Inter-600', fontWeight: '600' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridTouch: { width: '20%', alignItems: 'center', marginBottom: 14 },
  gridTile: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  continueBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { color: '#fff', fontSize: 16, fontFamily: 'Inter-700', fontWeight: '700' },

  loading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2,6,16,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    borderRadius: 18,
    paddingHorizontal: 34,
    paddingVertical: 26,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 15, fontFamily: 'Inter-600', fontWeight: '600' },
});
