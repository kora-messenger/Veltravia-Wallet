/**
 * Veltravia Wallet — theme provider.
 * Follows OS setting by default, overridable in Settings (persisted).
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, StatusBar, useColorScheme } from 'react-native';
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

  // Keep the strip behind the status bar the same colour as the app surface,
  // even when the in-app toggle differs from the phone's setting.
  // Appearance.setColorScheme switches the native DayNight resources too, so the
  // native window/content background (the strip under the status bar) follows
  // the in-app toggle. null hands control back to the phone's setting.
  useEffect(() => {
    Appearance.setColorScheme(override ?? 'unspecified');
    StatusBar.setBarStyle(mode === 'dark' ? 'light-content' : 'dark-content', true);
  }, [override, mode]);

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
