/**
 * Veltravia Wallet — secondary button (soft tinted pill).
 *
 * Same press feel as PrimaryButton so the whole app moves together:
 * the button sinks slightly and its soft shadow tightens, then springs
 * back on release. Used for "I already have a wallet" and "Deny".
 */
import React, { useRef } from 'react';
import { Pressable, Animated, Text, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export default function SecondaryButton({
  label,
  onPress,
  loading,
  disabled,
  height = 52,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const press = useRef(new Animated.Value(0)).current;

  const to = (v: number) =>
    Animated.spring(press, { toValue: v, speed: v === 1 ? 40 : 18, bounciness: v === 1 ? 0 : 9, useNativeDriver: true }).start();

  const y = press.interpolate({ inputRange: [0, 1], outputRange: [0, 3] });
  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] });

  return (
    <Pressable
      onPressIn={() => !disabled && !loading && to(1)}
      onPressOut={() => to(0)}
      onPress={onPress}
      disabled={disabled || loading}
      style={[{ height: height + 6, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Animated.View
        style={[
          styles.face,
          {
            height,
            borderRadius: height / 2.6,
            backgroundColor: dark ? 'rgba(108,99,255,0.24)' : 'rgba(108,99,255,0.12)',
            transform: [{ translateY: y }, { scale }],
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={theme.ink} />
        ) : (
          <Text style={[styles.label, { color: theme.ink }]} numberOfLines={1}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: { alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  label: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter-600', fontWeight: '600' },
});
