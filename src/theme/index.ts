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

// Field theme — Dark, website palette, high contrast for outdoor/sunlight use
export const fieldColors = {
  // Core — dark navy matching website
  bg: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#263448',
  border: '#334155',
  borderLight: '#2D3748',

  // Text — light on dark
  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  textInverse: '#0F172A',

  // Accent — Blue (website blue)
  accent: '#3B82F6',
  accentHover: '#60A5FA',
  accentLight: '#1E3A5F',

  // Status — bright for dark backgrounds
  success: '#4ADE80',
  successLight: '#052E16',
  danger: '#F87171',
  dangerLight: '#2A1010',
  warning: '#FBBF24',
  warningLight: '#2A1F00',
  info: '#60A5FA',
  infoLight: '#1E2F4A',

  // Variation status
  status: {
    captured: '#94A3B8',
    submitted: '#3B82F6',
    approved: '#4ADE80',
    disputed: '#F87171',
    paid: '#64748B',
  },
} as const;

// Office theme — Light, inverted website palette, clean for office/desktop use
export const officeColors = {
  // Core — light, slightly blue-tinted
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Text — dark navy on light
  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  // Accent — Blue (same as website + field)
  accent: '#3B82F6',
  accentHover: '#2563EB',
  accentLight: '#EFF6FF',

  // Status
  success: '#16A34A',
  successLight: '#F0FDF4',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  info: '#2563EB',
  infoLight: '#EFF6FF',

  // Variation status
  status: {
    captured: '#64748B',
    submitted: '#3B82F6',
    approved: '#16A34A',
    disputed: '#DC2626',
    paid: '#0F172A',
  },
} as const;

// Default export — field theme (overridden at runtime by AppModeContext)
export const colors = fieldColors;

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
    captured: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
    disputed: 'Disputed',
    paid: 'Paid',
  };
  return labels[status] ?? status;
}
