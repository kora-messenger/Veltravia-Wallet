/** Round provider avatar drawn in-app (no remote logos, no emoji). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Provider } from './providers';

export function ProviderMark({ provider, size = 52 }: { provider: Provider; size?: number }) {
  const bordered = provider.markBg.toUpperCase() === '#FFFFFF';
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: provider.markBg },
        bordered && styles.border,
      ]}
    >
      {provider.id === 'banktransfer' ? (
        <Svg width={size * 0.44} height={size * 0.44} viewBox="0 0 24 24" fill="none">
          <Path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" stroke={provider.markFg} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : (
        <Text style={[styles.mark, { color: provider.markFg, fontSize: size * 0.27 }]}>{provider.mark}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  border: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9DAE0' },
  mark: { fontFamily: 'Inter-700', fontWeight: '700' },
});
