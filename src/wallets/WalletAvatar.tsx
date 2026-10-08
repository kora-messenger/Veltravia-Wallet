/**
 * Veltravia Wallet — wallet avatar.
 *
 * - icon 'veltravia' + colour 'original': the untouched full-colour logo,
 *   no circle (the default for every new wallet).
 * - any other colour: coloured circle with the chosen glyph; the logo glyph
 *   renders as a white silhouette so it can be recoloured.
 * Legacy records (colour 'veltravia' with icon 'veltravia') read as original.
 */

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { WALLET_GLYPHS, WALLET_COLORS } from './WalletGlyphs';

export function WalletAvatar({
  icon,
  color,
  size = 44,
}: {
  icon: string;
  color: string;
  size?: number;
}) {
  const isOriginal = icon === 'veltravia' && (color === 'original' || color === 'veltravia');
  if (isOriginal) {
    return (
      <Image
        source={require('../assets/veltravia-logo.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  const Glyph = WALLET_GLYPHS[icon as keyof typeof WALLET_GLYPHS];
  const bg = WALLET_COLORS[color as keyof typeof WALLET_COLORS] ?? WALLET_COLORS.veltravia;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {Glyph ? <Glyph size={size * (icon === 'veltravia' ? 0.66 : 0.52)} color="rgba(255,255,255,0.96)" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
