/**
 * Veltravia Wallet — design tokens.
 *
 * Single source of truth for the visual identity. The UI reads colors ONLY
 * from here (via ThemeProvider), so a rebrand is a one-file change.
 *
 * Palette derived from the approved Veltravia mockup:
 *   - Brand gradient: #6C63FF → #4A90D9 (purple to blue)
 *   - Light mode: soft lavender-tinted surfaces
 *   - Dark mode: deep navy/near-black surfaces (Trust-style depth)
 */

export const palette = {
  // Brand
  violet: '#6C63FF',
  blue: '#4A90D9',

  // Semantic
  green: '#2ECC71',
  red: '#E74C3C',
  amber: '#F5A623',

  // Light surfaces
  light: {
    background: '#F4F5FB',
    surface: '#FFFFFF',
    surfaceAlt: '#EDEEF8',
    ink: '#14152B',
    inkMuted: '#6B6D8C',
    border: '#E2E3F2',
  },

  // Dark surfaces (near-black navy, Trust-style)
  dark: {
    background: '#0B0D1A',
    surface: '#141629',
    surfaceAlt: '#1C1E33',
    ink: '#FFFFFF',
    inkMuted: '#9AA0B8',
    border: '#23253C',
  },
} as const;

export type Theme = {
  mode: 'light' | 'dark';
  brand: string;
  brandGradient: readonly [string, string];
  background: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkMuted: string;
  border: string;
  positive: string;
  negative: string;
  warning: string;
};

export const themes: Record<'light' | 'dark', Theme> = {
  light: {
    mode: 'light',
    brand: palette.violet,
    brandGradient: [palette.violet, palette.blue],
    background: palette.light.background,
    surface: palette.light.surface,
    surfaceAlt: palette.light.surfaceAlt,
    ink: palette.light.ink,
    inkMuted: palette.light.inkMuted,
    border: palette.light.border,
    positive: palette.green,
    negative: palette.red,
    warning: palette.amber,
  },
  dark: {
    mode: 'dark',
    brand: palette.violet,
    brandGradient: [palette.violet, palette.blue],
    background: palette.dark.background,
    surface: palette.dark.surface,
    surfaceAlt: palette.dark.surfaceAlt,
    ink: palette.dark.ink,
    inkMuted: palette.dark.inkMuted,
    border: palette.dark.border,
    positive: palette.green,
    negative: palette.red,
    warning: palette.amber,
  },
};

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  h1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  h2: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  mono: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 }, // addresses, hashes
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;
