/**
 * Utility Helpers
 *
 * Common functions used throughout the app.
 */

import * as Crypto from 'expo-crypto';

/**
 * Generate a UUID v4 for client-side ID creation.
 * Critical for offline-first — we can't depend on the server for IDs.
 */
export function generateId(): string {
  return Crypto.randomUUID();
}

/** Current time as ISO 8601 string */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Format cents to display currency: 1250000 → "$12,500"
 */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

/**
 * Format cents to input-friendly string: 1250000 → "12500"
 */
export function centsToInputString(cents: number): string {
  return (cents / 100).toString();
}

/**
 * Parse user input to cents: "12,500" → 1250000
 */
export function parseInputToCents(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, '');
  const dollars = parseFloat(cleaned) || 0;
  return Math.round(dollars * 100);
}

/**
 * Format a variation sequence number: 3 → "VAR-003"
 */
export function formatVariationId(sequenceNumber: number): string {
  return `VAR-${sequenceNumber.toString().padStart(3, '0')}`;
}

/**
 * Relative time display: "2 hours ago", "Yesterday", "3 days ago"
 */
export function timeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date for display: "06 Feb 2026, 9:41 AM"
 */
export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date only: "06 Feb 2026"
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format recording duration: 45 → "0:45", 125 → "2:05"
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
