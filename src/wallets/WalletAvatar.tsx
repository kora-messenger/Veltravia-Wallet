/**
 * Veltravia Wallet — wallet avatar.
 *
 * Coloured circle with the chosen glyph inside. The special 'veltravia'
 * icon shows the app logo instead of a glyph.
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
  if (icon === 'veltravia') {
    return (
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF' }]}>
        <Image
          source={require('../assets/veltravia-logo.png')}
          style={{ width: size * 0.78, height: size * 0.78 }}
          resizeMode="contain"
        />
      </View>
    );
  }
  const Glyph = WALLET_GLYPHS[icon as keyof typeof WALLET_GLYPHS];
  const bg = WALLET_COLORS[color as keyof typeof WALLET_COLORS] ?? WALLET_COLORS.veltravia;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {Glyph ? <Glyph size={size * 0.52} color="rgba(255,255,255,0.96)" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
