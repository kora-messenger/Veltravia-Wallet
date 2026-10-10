/**
 * Veltravia Wallet — primary CTA button.
 *
 * Matches Trust's sharp look (measured from their button: flat saturated
 * fill, 48px, fully-rounded pill, white 16/600 label) but fills with
 * Veltravia's saturated violet -> blue `buttonGradient`.
 */
import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

export default function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, { opacity: disabled ? 0.45 : pressed ? 0.88 : 1 }, style]}
    >
      <LinearGradient
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        colors={theme.buttonGradient as unknown as string[]}
        style={styles.fill}
      >
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.label}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { height: 48, borderRadius: 24, overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#FFFFFF', fontSize: 16, lineHeight: 22, fontFamily: 'Inter-600' },
});
