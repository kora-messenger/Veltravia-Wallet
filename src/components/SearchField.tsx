/**
 * Veltravia Wallet — shared search pill (Trust parity).
 *
 * - Magnifier at left, placeholder when empty.
 * - The round "X" clear button is rendered ONLY while there is text; with
 *   an empty field nothing is shown at the right edge.
 * - Tapping X clears the text and keeps the keyboard open (Trust behavior),
 *   so the user can type a new query immediately.
 */
import React, { useRef } from 'react';
import { View, TextInput, Pressable, StyleSheet, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { SearchIcon, CloseIcon } from './icons';

interface Props extends Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (t: string) => void;
  style?: StyleProp<ViewStyle>;
  height?: number;
}

export default function SearchField({ value, onChangeText, style, height = 44, ...rest }: Props) {
  const { theme } = useTheme();
  const inputRef = useRef<any>(null);
  const dark = theme.mode === 'dark';

  return (
    <View style={[styles.pill, { height, backgroundColor: dark ? '#1D2133' : '#F4F4F6' }, style]}>
      <SearchIcon size={20} color={theme.inkMuted} />
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: theme.ink }]}
        placeholder="Search"
        placeholderTextColor={theme.inkMuted}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      {value.length > 0 && (
        <Pressable
          hitSlop={12}
          onPress={() => {
            onChangeText('');
            inputRef.current?.focus();
          }}
        >
          <View style={[styles.clearDot, { backgroundColor: dark ? '#8A8EA3' : '#8E8E93' }]}>
            <CloseIcon size={10} color="#FFFFFF" strokeWidth={3} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, fontFamily: 'Inter-400', padding: 0 },
  clearDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
