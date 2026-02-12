/**
 * Design System — Construction Industrial
 *
 * Built for outdoor use on construction sites:
 * - High contrast for direct sunlight
 * - Large touch targets for gloved hands
 * - Safety orange accent (AS 1319 compliant)
 * - Warm neutral backgrounds that reduce glare
 */

import { TextStyle } from 'react-native';

// ============================================================
// COLOURS
// ============================================================

export const colors = {
  // Core
  bg: '#F5F2ED',
  surface: '#FFFFFF',
  surfaceAlt: '#EDE9E3',
  border: '#D4CFC7',
  borderLight: '#E8E4DD',

  // Text
  text: '#1A1A1A',
  textSecondary: '#4A4A4A',
  textMuted: '#8A8580',
  textInverse: '#FFFFFF',

  // Accent — Safety Orange
  accent: '#D4600A',
  accentHover: '#B8520A',
  accentLight: '#FFF0E6',

  // Status
  success: '#2D7D46',
  successLight: '#E8F5E9',
  danger: '#C62828',
  dangerLight: '#FFEBEE',
  warning: '#F57F17',
  warningLight: '#FFF8E1',
  info: '#1565C0',
  infoLight: '#E3F2FD',

  // Variation status
  status: {
    captured: '#D4600A',
    submitted: '#1565C0',
    approved: '#2D7D46',
    disputed: '#C62828',
    paid: '#1A1A1A',
  },
} as const;

// ============================================================
// SPACING
// ============================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
} as const;

// ============================================================
// BORDER RADIUS
// ============================================================

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

// ============================================================
// TOUCH TARGETS — Glove-friendly minimums
// ============================================================

export const touchTargets = {
  minimum: 48,
  button: 52,
  fab: 64,
} as const;

// ============================================================
// TYPOGRAPHY
// ============================================================

type TypographyStyle = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing'>;

export const typography: Record<string, TypographyStyle> = {
  headingLarge: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  headingMedium: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  headingSmall: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  labelLarge: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  labelMedium: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  labelSmall: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  overline: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: 0.8,
  },
} as const;

// ============================================================
// STATUS HELPERS
// ============================================================

export function getStatusColor(status: string): string {
  return (colors.status as Record<string, string>)[status] ?? colors.textMuted;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    captured: 'Captured',
    submitted: 'Submitted',
    approved: 'Approved',
    disputed: 'Disputed',
    paid: 'Paid',
  };
  return labels[status] ?? status;
}
