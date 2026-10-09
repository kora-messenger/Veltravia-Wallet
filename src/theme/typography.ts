/**
 * Veltravia Wallet — typography & spacing tokens.
 *
 * Extracted from Trust Wallet's own compiled design system
 * (decompiled android-trust.jsbundle, VARIANT_SPECS + radii/spacing
 * tables, 2026-10-09). These are Trust's real values, not estimates.
 *
 * Text variants (Paragraph line heights):
 *   LargeTitle 48 Bold   Title3 28 Bold   Title2 24 Bold   Title1 20 Bold
 *   Heading    16 SemiBold               Emphasis 14 SemiBold
 *   Subtitle   16 Medium                  Body     14 Medium
 *   Footnote   12 Medium                  Caption1 12 SemiBold   Caption2 10 SemiBold
 *
 * Button sizes:  large h56 / icon 24 / text 16 SemiBold
 *                 medium h44 / icon 20 / text 14 SemiBold
 *                 small  h32 / icon 16 / text 12 SemiBold
 *
 * Spacing: xxs2 xs4 sm8 mdsm12 md16 mdlg20 lg24 xl32 xxl40 xxxl48
 * Radii:   xxs2 xs4 sm8 mdsm12 md16 lg24 xl32 xxl40 full9999
 */

export const FONT = {
  regular: 'Inter-400',
  medium: 'Inter-500',
  semiBold: 'Inter-600',
  bold: 'Inter-700',
} as const;

/** Trust text variants, ready to spread into RN text styles. */
export const T = {
  largeTitle: { fontFamily: FONT.bold, fontSize: 48, lineHeight: 67 },
  title3: { fontFamily: FONT.bold, fontSize: 28, lineHeight: 39 },
  title2: { fontFamily: FONT.bold, fontSize: 24, lineHeight: 34 },
  title1: { fontFamily: FONT.bold, fontSize: 20, lineHeight: 28 },
  heading: { fontFamily: FONT.semiBold, fontSize: 16, lineHeight: 22 },
  emphasis: { fontFamily: FONT.semiBold, fontSize: 14, lineHeight: 20 },
  subtitle: { fontFamily: FONT.medium, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: FONT.medium, fontSize: 14, lineHeight: 20 },
  footnote: { fontFamily: FONT.medium, fontSize: 12, lineHeight: 17 },
  caption1: { fontFamily: FONT.semiBold, fontSize: 12, lineHeight: 17 },
  caption2: { fontFamily: FONT.semiBold, fontSize: 10, lineHeight: 14 },
  buttonLarge: { fontFamily: FONT.semiBold, fontSize: 16 },
  buttonMedium: { fontFamily: FONT.semiBold, fontSize: 14 },
  buttonSmall: { fontFamily: FONT.semiBold, fontSize: 12 },
} as const;

/** Trust spacing scale. */
export const SP = {
  xxs: 2,
  xs: 4,
  sm: 8,
  mdsm: 12,
  md: 16,
  mdlg: 20,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
} as const;

/** Trust radius scale. */
export const RADIUS = {
  xxs: 2,
  xs: 4,
  sm: 8,
  mdsm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  full: 9999,
} as const;

/** Touch target sizes (Trust header buttons). */
export const TOUCH = {
  headerCircle: 36,
  headerIcon: 24,
  buttonLarge: 56,
  buttonMedium: 44,
  buttonSmall: 32,
} as const;
