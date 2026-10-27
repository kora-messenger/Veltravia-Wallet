/**
 * Veltravia Wallet — Hyperliquid / Aster brand marks (Perps venues).
 * Sized so they can serve as list icons (32) or inline header marks (22).
 */
import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

/** Hyperliquid mark: dark rounded tile, mint "H" wave. */
export function HyperliquidTile({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="8" fill="#072723" />
      <Path d="M6 16c2.6 0 3.2-5 5.4-5 2.4 0 2 4 4.6 4s2.2-4 4.6-4C22.8 11 23.4 16 26 16c-2.6 0-3.2 5-5.4 5-2.4 0-2-4-4.6-4s-2.2 4-4.6 4C9.2 21 8.6 16 6 16z" fill="#97FCE4" />
    </Svg>
  );
}

/** Aster mark: dark tile, warm round emblem with the compass cut. */
export function AsterTile({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect width="32" height="32" rx="8" fill="#16130F" />
      <Path d="M16 6.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z" fill="#F4C79A" />
      <Path d="M16 6.5v19M6.5 16h19M9.3 9.3l13.4 13.4M22.7 9.3L9.3 22.7" stroke="#16130F" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}
