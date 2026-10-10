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
  green: '#1DB88E',
  red: '#E74C3C',
  amber: '#F5A623',

  // Light surfaces — pure white page, per mockup
  light: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#F3F4FA',
    ink: '#14152B',
    inkMuted: '#7B7E96',
    border: '#EEF0F6',
  },

  // Dark surfaces — near-black (#02070E measured from mockup)
  dark: {
    background: '#02070E',
    surface: '#07101E',
    surfaceAlt: '#0D1626',
    ink: '#FFFFFF',
    inkMuted: '#8E96AD',
    border: '#121C2E',
  },

  // Primary CTA buttons: saturated + short-range so the fill reads SHARP like
  // Trust's flat #382FFA (measured), while staying violet -> blue.
  button: ['#5B3DF5', '#2F6BF0'],

  // Balance card gradient (measured): left→right
  card: {
    light: ['#6A4BFC', '#1FA0FD'],
    dark: ['#3A22CC', '#1368E0'],
  },

  // Quick-action tiles (measured): [background, icon]
  tiles: {
    light: {
      send: ['#E9E5FE', '#6C4CF5'],
      receive: ['#D9F0FC', '#1E9BE8'],
      swap: ['#E4EAFD', '#4D55F2'],
      buy: ['#DDEBFD', '#2F6FF0'],
    },
    dark: {
      send: ['#121B47', '#8B6CFF'],
      receive: ['#0B1F63', '#5AB4FF'],
      swap: ['#092053', '#4FA6FF'],
      buy: ['#082156', '#6C8BFF'],
    },
  },
} as const;

export type Theme = {
  mode: 'light' | 'dark';
  brand: string;
  brandGradient: readonly [string, string];
  buttonGradient: readonly [string, string];
  background: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  inkMuted: string;
  border: string;
  positive: string;
  negative: string;
  warning: string;
  cardGradient: readonly [string, string];
  tiles: Record<'send' | 'receive' | 'swap' | 'buy', readonly [string, string]>;
};

export const themes: Record<'light' | 'dark', Theme> = {
  light: {
    mode: 'light',
    brand: palette.violet,
    brandGradient: [palette.violet, palette.blue],
    buttonGradient: palette.button as unknown as readonly [string, string],
    background: palette.light.background,
    surface: palette.light.surface,
    surfaceAlt: palette.light.surfaceAlt,
    ink: palette.light.ink,
    inkMuted: palette.light.inkMuted,
    border: palette.light.border,
    positive: palette.green,
    negative: palette.red,
    warning: palette.amber,
    cardGradient: palette.card.light as unknown as readonly [string, string],
    tiles: palette.tiles.light as unknown as Theme['tiles'],
  },
  dark: {
    mode: 'dark',
    brand: palette.violet,
    brandGradient: [palette.violet, palette.blue],
    buttonGradient: palette.button as unknown as readonly [string, string],
    background: palette.dark.background,
    surface: palette.dark.surface,
    surfaceAlt: palette.dark.surfaceAlt,
    ink: palette.dark.ink,
    inkMuted: palette.dark.inkMuted,
    border: palette.dark.border,
    positive: palette.green,
    negative: palette.red,
    warning: palette.amber,
    cardGradient: palette.card.dark as unknown as readonly [string, string],
    tiles: palette.tiles.dark as unknown as Theme['tiles'],
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
