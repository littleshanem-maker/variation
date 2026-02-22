/**
 * Design System — Assured, Professional, Site-Ready
 *
 * Mobile: Purpose-built instrument for the hand, the pocket, and the construction site.
 * Desktop (Office): Senior consultant's personal system — calm, structured, quietly expensive.
 *
 * Readability in harsh sunlight, thumb-friendly touch targets, glanceable hierarchy.
 */

import { TextStyle } from 'react-native';

// ============================================================
// COLOURS
// ============================================================

// Field theme — Warm, assured, outdoor-legible
export const fieldColors = {
  // Core — warm off-white, brighter than desktop for sunlight legibility
  bg: '#FBFBF9',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F3EF',
  border: '#EEEEEB',
  borderLight: '#F5F3EF',

  // Text — deepened for small-screen contrast
  text: '#18181B',
  textSecondary: '#525963',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Accent — deep muted navy, authority colour
  accent: '#1B365D',
  accentHover: '#24466F',
  accentLight: '#1B365D0D',

  // Status — desaturated, sophisticated
  success: '#4A7C6F',
  successLight: '#F0F7F4',
  danger: '#B25B4E',
  dangerLight: '#FDF2F0',
  warning: '#C8943E',
  warningLight: '#FDF8ED',
  info: '#1B365D',
  infoLight: '#1B365D0D',

  // Variation status — sage green, warm amber, clay red, cool gray
  status: {
    captured: '#9CA3AF',
    submitted: '#C8943E',
    approved: '#4A7C6F',
    disputed: '#B25B4E',
    paid: '#18181B',
  },

  // Gold highlight — for selected/active states
  gold: '#D4A853',
} as const;

// Office theme — Same palette, light variant for desktop use
export const officeColors = {
  // Core — warm off-white
  bg: '#F8F8F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F3EF',
  border: '#E5E7EB',
  borderLight: '#F0F0EE',

  // Text
  text: '#1C1C1E',
  textSecondary: '#525963',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Accent — deep muted navy
  accent: '#1B365D',
  accentHover: '#24466F',
  accentLight: '#1B365D0D',

  // Status
  success: '#4A7C6F',
  successLight: '#F0F7F4',
  danger: '#B25B4E',
  dangerLight: '#FDF2F0',
  warning: '#C8943E',
  warningLight: '#FDF8ED',
  info: '#1B365D',
  infoLight: '#1B365D0D',

  // Variation status
  status: {
    captured: '#9CA3AF',
    submitted: '#C8943E',
    approved: '#4A7C6F',
    disputed: '#B25B4E',
    paid: '#1C1C1E',
  },

  // Gold highlight
  gold: '#D4A853',
} as const;

// Default export — field theme (overridden at runtime by AppModeContext)
export const colors = fieldColors;

// ============================================================
// SPACING — 8px grid, mobile minimum 12px between content
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
// BORDER RADIUS — 10px cards (soft, handheld), 6px contents (crisp)
// ============================================================

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

// ============================================================
// TOUCH TARGETS — 44pt minimum (Apple HIG)
// ============================================================

export const touchTargets = {
  minimum: 44,
  button: 48,
  fab: 56,
} as const;

// ============================================================
// SHADOWS — Mobile: slightly more depth than desktop
// ============================================================

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
} as const;

// ============================================================
// TYPOGRAPHY — Mobile-optimised sizing, 1.5x line height
// ============================================================

type TypographyStyle = Pick<TextStyle, 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing'>;

export const typography: Record<string, TypographyStyle> = {
  // Screen titles — commanding but compact
  headingLarge: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
  },
  headingMedium: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  headingSmall: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  // Card/item titles — primary scanning size
  bodyLarge: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  // Supporting data
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
  },
  // Financial figures — prominent, tabular
  valueLarge: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  labelLarge: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  labelMedium: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  labelSmall: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
  },
  // Column headers/labels — subtle, tracked
  overline: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: 0.4,
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

/** Status background colours for pills */
export function getStatusBg(status: string): string {
  const bgs: Record<string, string> = {
    captured: '#F3F4F6',
    submitted: '#FDF8ED',
    approved: '#F0F7F4',
    disputed: '#FDF2F0',
    paid: '#F3F4F6',
  };
  return bgs[status] ?? '#F3F4F6';
}

/** Status text colours for pills */
export function getStatusTextColor(status: string): string {
  const textColors: Record<string, string> = {
    captured: '#6B7280',
    submitted: '#92722E',
    approved: '#3D6B5E',
    disputed: '#9A4A3E',
    paid: '#18181B',
  };
  return textColors[status] ?? '#6B7280';
}
