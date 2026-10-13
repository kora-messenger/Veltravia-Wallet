/**
 * Veltravia Wallet — coin logos (pure SVG, no text glyphs or emojis).
 * Round brand-colored badge with the coin mark drawn as vector paths.
 */
import React from 'react';
import Svg, { Circle, Path, Polygon, Rect, G } from 'react-native-svg';

interface Props {
  symbol: string;
  color: string;
  size?: number;
}

function Mark({ symbol }: { symbol: string }) {
  switch (symbol) {
    case 'BTC':
      return (
        <G fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M9.6 7.2h3.9a1.9 1.9 0 010 3.8H9.6z" />
          <Path d="M9.6 11h4.3a2.1 2.1 0 010 4.2H9.6z" />
          <Path d="M9.6 7.2V15.2M11.2 5.6v1.6M13.2 5.6v1.6M11.2 15.2v1.6M13.2 15.2v1.6" />
        </G>
      );
    case 'ETH':
      return (
        <G fill="#FFFFFF">
          <Polygon points="12,4 17.4,12.2 12,15.2 6.6,12.2" opacity={0.95} />
          <Polygon points="12,16.4 17.4,13.4 12,20 6.6,13.4" opacity={0.75} />
        </G>
      );
    case 'BNB':
      return (
        <G fill="#F3BA2F">
          <Polygon points="12,5.2 14.1,7.3 12,9.4 9.9,7.3" />
          <Polygon points="6.6,10.6 8.7,12.7 6.6,14.8 4.5,12.7" />
          <Polygon points="17.4,10.6 19.5,12.7 17.4,14.8 15.3,12.7" />
          <Polygon points="12,16 14.1,18.1 12,20.2 9.9,18.1" />
          <Polygon points="12,10.4 14.3,12.7 12,15 9.7,12.7" />
        </G>
      );
    case 'SOL':
      return (
        <G fill="#FFFFFF">
          <Path d="M6.5 8.2h10.6l-1.6 2H4.9z" />
          <Path d="M6.5 11.4h10.6l-1.6 2H4.9z" opacity={0.85} transform="translate(2.1 0)" />
          <Path d="M6.5 14.6h10.6l-1.6 2H4.9z" />
        </G>
      );
    case 'USDT':
      return (
        <G fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round">
          <Path d="M7 7.2h10M12 7.2V17" />
          <Path d="M8.2 11.4c0 1 1.7 1.7 3.8 1.7s3.8-.7 3.8-1.7-1.7-1.7-3.8-1.7-3.8.7-3.8 1.7z" />
        </G>
      );
    case 'TRX':
      return (
        <G fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round">
          <Path d="M6 7l12 2-6.8 10z" />
          <Path d="M6 7l7 5.4M18 9l-4.8 3.4" />
        </G>
      );
    default:
      // generic coin: ring + inner dot (POL, LTC, LINK, UNI ...)
      return (
        <G>
          <Circle cx={12} cy={12} r={5.2} fill="none" stroke="#FFFFFF" strokeWidth={1.9} />
          <Circle cx={12} cy={12} r={1.7} fill="#FFFFFF" />
        </G>
      );
  }
}

export default function CoinLogo({ symbol, color, size = 32 }: Props) {
  const bg = symbol === 'BNB' ? '#14151A' : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={12} fill={bg} />
      <Mark symbol={symbol} />
    </Svg>
  );
}
