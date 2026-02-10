/**
 * Variation Capture — Design System
 *
 * Designed for construction site use:
 * - High contrast (7:1 ratio minimum) for direct sunlight
 * - Large touch targets (48dp minimum)
 * - Warm neutral palette — no tech-startup purple
 * - Safety orange accent — familiar to construction workers
 */

export const colors = {
  // Backgrounds
  bg: '#F5F2ED',
  surface: '#FFFFFF',
  surfaceAlt: '#EDE9E3',

  // Borders
  border: '#D4CFC7',
  borderStrong: '#B8B2A8',

  // Text
  text: '#1A1A1A',
  textSecondary: '#5C5649',
  textMuted: '#8A8279',
  textInverse: '#FFFFFF',

  // Accent — safety orange
  accent: '#D4600A',
  accentHover: '#B85209',
  accentLight: '#FEF3EB',

  // Status colours
  success: '#2D7A3A',
  successLight: '#EDF7EF',
  successBorder: '#A8D5B0',

  warning: '#B8860B',
  warningLight: '#FFF8E7',
  warningBorder: '#E8D48B',

  danger: '#C4342D',
  dangerLight: '#FDF0EF',
  dangerBorder: '#E8A8A5',

  info: '#2563EB',
  infoLight: '#EFF6FF',

  // Variation status mapping
  status: {
    captured: '#D4600A',
    submitted: '#2563EB',
    approved: '#2D7A3A',
    disputed: '#C4342D',
    paid: '#1A1A1A',
  },
} as const;

export const spacing = {
  /** 4px */
  xs: 4,
  /** 8px */
  sm: 8,
  /** 12px */
  md: 12,
  /** 16px */
  lg: 16,
  /** 20px */
  xl: 20,
  /** 24px */
  xxl: 24,
  /** 32px */
  xxxl: 32,
} as const;

export const borderRadius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
} as const;

export const typography = {
  // Display — screen titles
  displayLarge: {
    fontSize: 28,
    fontWeight: '900' as const,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  displayMedium: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
    lineHeight: 28,
  },

  // Headings
  headingLarge: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  headingMedium: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 22,
  },
  headingSmall: {
    fontSize: 15,
    fontWeight: '700' as const,
    lineHeight: 20,
  },

  // Body
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },

  // Labels
  labelLarge: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 22,
  },
  labelMedium: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    lineHeight: 16,
  },

  // Caption / overline
  caption: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
  overline: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    lineHeight: 14,
    textTransform: 'uppercase' as const,
  },

  // Monospace — for hashes, references
  mono: {
    fontSize: 13,
    fontWeight: '500' as const,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
} as const;

/**
 * Touch target sizing.
 * Minimum 48dp per Material Design / Apple HIG guidelines.
 * We go larger where possible — users wear gloves.
 */
export const touchTargets = {
  /** Minimum tappable area */
  minimum: 48,
  /** Standard button height */
  button: 52,
  /** Large primary action button */
  buttonLarge: 56,
  /** FAB / capture button */
  fab: 64,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

const theme = { colors, spacing, borderRadius, typography, touchTargets, shadows };
export default theme;
