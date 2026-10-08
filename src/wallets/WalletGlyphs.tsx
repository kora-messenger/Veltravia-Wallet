/**
 * Veltravia Wallet — wallet glyph set + colour palette for the
 * "Name your wallet" picker (mirrors Trust Wallet's 5x4 grid).
 *
 * Glyphs are monochrome SVG strokes; they render inside a coloured circle.
 * Colours are the pickable tints for the wallet avatar.
 */

import React from 'react';
import { Image } from 'react-native';
import Svg, { Circle, Path, Polygon, Rect, Text as SvgText, G } from 'react-native-svg';

interface GlyphProps {
  size?: number;
  color?: string;
}

// -- 20 glyphs (5 columns x 4 rows), Trust-style --------------------------

const wrap = (children: React.ReactNode, { size = 24 }: GlyphProps, viewBox = '0 0 24 24') => (
  <Svg width={size} height={size} viewBox={viewBox}>
    {children}
  </Svg>
);

export const WalletGlyph = (p: GlyphProps) =>
  wrap(
    <G fill="none" stroke={p.color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" />
      <Path d="M3 7.5V17a3 3 0 0 0 3 3h13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5.5" />
      <Circle cx="16.5" cy="13.5" r="1.4" fill={p.color} stroke="none" />
    </G>,
    p,
  );

/** White logo silhouette; used when the wallet avatar has a chosen colour. */
export const LogoGlyph = (p: GlyphProps) => (
  <Image
    source={require('../assets/veltravia-logo-white.png')}
    style={{ width: p.size ?? 24, height: p.size ?? 24 }}
    resizeMode="contain"
  />
);

/** Full-colour logo (for grid tiles that are not on a coloured circle). */
export const LogoColorGlyph = (p: GlyphProps) => (
  <Image
    source={require('../assets/veltravia-logo.png')}
    style={{ width: p.size ?? 24, height: p.size ?? 24 }}
    resizeMode="contain"
  />
);

export const TextGlyph = (p: GlyphProps) =>
  wrap(
    <SvgText fill={p.color} fontSize="12" fontWeight="700" x="12" y="16.5" textAnchor="middle" fontFamily="System">
      Aa
    </SvgText>,
    p,
  );

export const ShieldGlyph = (p: GlyphProps) =>
  wrap(
    <Path
      d="M12 3l7 3v5.5c0 4.6-3 8-7 9.5-4-1.5-7-4.9-7-9.5V6l7-3z"
      fill="none"
      stroke={p.color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />,
    p,
  );

export const DiamondGlyph = (p: GlyphProps) =>
  wrap(
    <Polygon points="12,3 20,12 12,21 4,12" fill="none" stroke={p.color} strokeWidth={1.8} strokeLinejoin="round" />,
    p,
  );

export const RocketGlyph = (p: GlyphProps) =>
  wrap(
    <G fill="none" stroke={p.color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M12 3c3.5 2 5 5.5 5 9l-2.5 2.5h-5L7 12c0-3.5 1.5-7 5-9z" />
      <Circle cx="12" cy="9.5" r="1.6" />
      <Path d="M9.5 15.5L7 20M14.5 15.5L17 20" />
    </G>,
    p,
  );

export const BtcGlyph = (p: GlyphProps) =>
  wrap(<SvgText fill={p.color} fontSize="16" fontWeight="800" x="12" y="17.5" textAnchor="middle" fontFamily="System">₿</SvgText>, p);

export const BnbGlyph = (p: GlyphProps) =>
  wrap(<SvgText fill={p.color} fontSize="14" fontWeight="800" x="12" y="17" textAnchor="middle" fontFamily="System">BNB</SvgText>, p);

export const EthGlyph = (p: GlyphProps) =>
  wrap(
    <G fill={p.color}>
      <Polygon points="12,3 18,12 12,15 6,12" opacity="0.95" />
      <Polygon points="12,16.5 18,13.2 12,21 6,13.2" opacity="0.65" />
    </G>,
    p,
  );

export const SolGlyph = (p: GlyphProps) =>
  wrap(
    <G fill="none" stroke={p.color} strokeWidth={1.9} strokeLinecap="round">
      <Path d="M6 8h11l-2.5-2.5" />
      <Path d="M18 16H7l2.5 2.5" />
    </G>,
    p,
  );

export const TrxGlyph = (p: GlyphProps) =>
  wrap(
    <G fill="none" stroke={p.color} strokeWidth={1.7} strokeLinejoin="round">
      <Polygon points="5,5 19,7.5 15,19.5 8,15" />
      <Path d="M5 5l10 10 4-7.5" />
    </G>,
    p,
  );

export const HeartGlyph = (p: GlyphProps) =>
  wrap(
    <Path
      d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"
      fill="none"
      stroke={p.color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />,
    p,
  );

export const DollarGlyph = (p: GlyphProps) =>
  wrap(
    <G fill="none" stroke={p.color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M12 3v18" />
      <Path d="M16 6.5c0-1.4-1.8-2.5-4-2.5S8 5.1 8 6.6c0 4 8 2.4 8 6.9 0 1.6-1.8 2.7-4 2.7s-4-1.1-4-2.5" />
    </G>,
    p,
  );

export const CardGlyph = (p: GlyphProps) =>
  wrap(
    <G fill="none" stroke={p.color} strokeWidth={1.8} strokeLinejoin="round">
      <Rect x="3" y="6" width="18" height="13" rx="2.5" />
      <Path d="M3 10.5h18" />
      <Path d="M6.5 15.5h4" strokeLinecap="round" />
    </G>,
    p,
  );

export const FireGlyph = (p: GlyphProps) =>
  wrap(
    <Path
      d="M12 3c1 3-2 4.5-2 7 0 1.2.8 2 1.6 2.6-.3-1.6.6-2.6 1.4-3.6.5 2.5 3 3.5 3 6.5a5 5 0 0 1-10 0c0-3 2-4.5 2-7.5 0 0 3.5 1 4-5z"
      fill="none"
      stroke={p.color}
      strokeWidth={1.7}
      strokeLinejoin="round"
    />,
    p,
  );

export const TrophyGlyph = (p: GlyphProps) =>
  wrap(
    <G fill="none" stroke={p.color} strokeWidth={1.7} strokeLinejoin="round">
      <Path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <Path d="M7 5H4.5v2A2.5 2.5 0 0 0 7 9.5M17 5h2.5v2A2.5 2.5 0 0 1 17 9.5" />
      <Path d="M12 13v4M8.5 20h7M10 17h4v3h-4z" />
    </G>,
    p,
  );

export const PiggyGlyph = (p: GlyphProps) =>
  wrap(
    <G fill="none" stroke={p.color} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M4 12a6 6 0 0 1 6-6h4.5c3 0 5.5 2.5 5.5 5.5 0 1.2-.4 2.3-1 3.2V19a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.5H9v.5a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-2.6A6 6 0 0 1 4 12z" />
      <Path d="M15 10.5h.01" />
      <Path d="M11.5 6l1.5-2.5" />
    </G>,
    p,
  );

export const KeyGlyph = (p: GlyphProps) =>
  wrap(
    <G fill="none" stroke={p.color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      <Circle cx="8" cy="8" r="4" />
      <Path d="M11 11l8 8M16 16l2-2M13.5 13.5l2-2" />
    </G>,
    p,
  );

export const PlantGlyph = (p: GlyphProps) =>
  wrap(
    <G fill="none" stroke={p.color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M12 21V10" />
      <Path d="M12 10C12 6 9 4 5.5 4 5.5 8 8 10 12 10zM12 13c0-3.5 3-5.5 6.5-5.5 0 4-2.5 5.5-6.5 5.5z" />
    </G>,
    p,
  );

export const GiftGlyph = (p: GlyphProps) =>
  wrap(
    <G fill="none" stroke={p.color} strokeWidth={1.7} strokeLinejoin="round">
      <Rect x="4" y="9" width="16" height="4" rx="1" />
      <Path d="M5.5 13v6a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-6" />
      <Path d="M12 9v11" />
      <Path d="M12 9C10 9 7.5 8.5 7.5 6.5S10.5 4 12 7c1.5-3 4.5-3.5 4.5-.5S14 9 12 9z" />
    </G>,
    p,
  );

export const StarGlyph = (p: GlyphProps) =>
  wrap(
    <Polygon
      points="12,3 14.7,8.6 21,9.4 16.5,13.7 17.6,20 12,17 6.4,20 7.5,13.7 3,9.4 9.3,8.6"
      fill="none"
      stroke={p.color}
      strokeWidth={1.7}
      strokeLinejoin="round"
    />,
    p,
  );

export type WalletGlyphKey =
  | 'veltravia' | 'text' | 'wallet' | 'shield' | 'diamond' | 'rocket'
  | 'btc' | 'bnb' | 'eth' | 'sol' | 'trx'
  | 'heart' | 'dollar' | 'card' | 'fire' | 'trophy'
  | 'piggy' | 'key' | 'plant' | 'gift' | 'star';

export const WALLET_GLYPHS: Record<WalletGlyphKey, React.ComponentType<GlyphProps>> = {
  veltravia: LogoGlyph,
  text: TextGlyph,
  wallet: WalletGlyph,
  shield: ShieldGlyph,
  diamond: DiamondGlyph,
  rocket: RocketGlyph,
  btc: BtcGlyph,
  bnb: BnbGlyph,
  eth: EthGlyph,
  sol: SolGlyph,
  trx: TrxGlyph,
  heart: HeartGlyph,
  dollar: DollarGlyph,
  card: CardGlyph,
  fire: FireGlyph,
  trophy: TrophyGlyph,
  piggy: PiggyGlyph,
  key: KeyGlyph,
  plant: PlantGlyph,
  gift: GiftGlyph,
  star: StarGlyph,
};

export const GLYPH_ORDER: WalletGlyphKey[] = [
  'veltravia', 'text', 'wallet', 'shield', 'diamond',
  'rocket', 'btc', 'bnb', 'eth', 'sol',
  'trx', 'heart', 'dollar', 'card', 'fire',
  'trophy', 'piggy', 'key', 'plant', 'gift',
  'star',
];

// -- Avatar colours (Trust-style picker row) ------------------------------

export type WalletColorKey =
  | 'original' | 'veltravia' | 'teal' | 'purple' | 'pink' | 'blue' | 'indigo'
  | 'red' | 'orange' | 'amber' | 'green' | 'brown' | 'gray';

export const WALLET_COLORS: Record<WalletColorKey, string> = {
  original: '#FFFFFF', // the untouched full-colour logo (no tint)
  veltravia: '#6C63FF', // brand
  teal: '#26C6DA',
  purple: '#7E57C2',
  pink: '#EC407A',
  blue: '#42A5F5',
  indigo: '#5C6BC0',
  red: '#EF5350',
  orange: '#FFA726',
  amber: '#FDD835',
  green: '#66BB6A',
  brown: '#8D6E63',
  gray: '#90A4AE',
};

export const COLOR_ORDER: WalletColorKey[] = [
  'original', 'veltravia', 'teal', 'purple', 'pink', 'blue', 'indigo',
  'red', 'orange', 'amber', 'green', 'brown', 'gray',
];


/** Light -> deep diagonal gradient pairs for the glossy avatar circles. */
export const WALLET_GRADIENTS: Record<WalletColorKey, [string, string]> = {
  original: ['#FFFFFF', '#FFFFFF'],
  veltravia: ['#8B84FF', '#4A3FE8'],
  teal: ['#4DD9E8', '#1AA3B8'],
  purple: ['#A57CF0', '#7332C9'],
  pink: ['#FF6FB5', '#E5307F'],
  blue: ['#5FB4FF', '#2F7DE0'],
  indigo: ['#6D6DFF', '#2E27E6'],
  red: ['#F26A6A', '#D63B3B'],
  orange: ['#FFB547', '#F08A00'],
  amber: ['#FFE04D', '#EBB800'],
  green: ['#6BEE86', '#18B04E'],
  brown: ['#B08672', '#7A5546'],
  gray: ['#B4C0C8', '#7F909B'],
};
