/**
 * Empty-watchlist illustration: a small flying saucer beaming a light cone
 * down, in the Veltravia purple-to-blue range. Vector so it stays crisp on
 * every density; decorative, so hidden from screen readers.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';

export default function WatchlistEmptyArt({ size = 112 }: { size?: number }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size * 0.8 }}>
      <Svg width={size} height={size * 0.8} viewBox="0 0 120 96">
        <Defs>
          <LinearGradient id="beam" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#22D3EE" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#8B7BFF" stopOpacity="0.12" />
          </LinearGradient>
          <LinearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#3B3BFF" />
            <Stop offset="1" stopColor="#7C5CFF" />
          </LinearGradient>
        </Defs>
        {/* beam */}
        <Path d="M 46 40 L 24 90 Q 52 98 84 84 L 70 38 Z" fill="url(#beam)" />
        {/* saucer body */}
        <Ellipse cx="54" cy="30" rx="40" ry="15" fill="#10132B" />
        <Ellipse cx="54" cy="30" rx="40" ry="15" fill="none" stroke="url(#rim)" strokeWidth="2.4" />
        {/* dome opening */}
        <Ellipse cx="54" cy="27" rx="23" ry="8.5" fill="#1B2150" />
        <Ellipse cx="54" cy="27" rx="15" ry="5" fill="#5B8CFF" opacity="0.9" />
        <Ellipse cx="51" cy="25.6" rx="6" ry="1.8" fill="#BFE9FF" opacity="0.9" />
      </Svg>
    </View>
  );
}
