/**
 * Veltravia Wallet — theme provider.
 * Follows OS setting by default, overridable in Settings (persisted).
 */

import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Theme, themes } from './tokens';

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  /** User override; null = follow system. */
  setOverride: (mode: 'light' | 'dark' | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [override, setOverride] = useState<'light' | 'dark' | null>(null);

  const mode = override ?? (system === 'dark' ? 'dark' : 'light');
  const theme = themes[mode];

  const value: ThemeContextValue = {
    theme,
    isDark: mode === 'dark',
    setOverride,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
