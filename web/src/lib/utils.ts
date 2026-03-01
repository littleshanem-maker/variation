/** Format cents as AUD dollars with commas, no cents shown */
export function formatCurrency(cents: number): string {
  const dollars = Math.round(cents / 100);
  return '$' + dollars.toLocaleString('en-AU');
}

/** Format a date string for legal/PDF documents — explicit, unambiguous timestamp */
export function formatDocDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

/** Format a date-only field for PDFs (no time component) */
export function formatDocDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/** Format a date string as relative or absolute */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 14) return `${diffDays} days ago`;

  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/** Status display config — desaturated, sophisticated tones */
export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft: {
    label: 'Draft',
    color: 'text-[#374151]',
    bg: 'bg-[#F3F4F6]',
    border: 'border-[#9CA3AF]',
    dot: 'bg-[#9CA3AF]',
  },
  captured: {
    // Legacy alias for draft — backward compat
    label: 'Draft',
    color: 'text-[#374151]',
    bg: 'bg-[#F3F4F6]',
    border: 'border-[#9CA3AF]',
    dot: 'bg-[#9CA3AF]',
  },
  submitted: {
    label: 'Submitted',
    color: 'text-[#92722E]',
    bg: 'bg-[#FDF8ED]',
    border: 'border-[#C8943E]',
    dot: 'bg-[#C8943E]',
  },
  approved: {
    label: 'Approved',
    color: 'text-[#3D6B5E]',
    bg: 'bg-[#F0F7F4]',
    border: 'border-[#4A7C6F]',
    dot: 'bg-[#4A7C6F]',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-[#5B3A7C]',
    bg: 'bg-[#F5F0FA]',
    border: 'border-[#7C5BA0]',
    dot: 'bg-[#7C5BA0]',
  },
  paid: {
    label: 'Paid',
    color: 'text-[#1C1C1E]',
    bg: 'bg-[#F3F4F6]',
    border: 'border-[#1C1C1E]',
    dot: 'bg-[#1C1C1E]',
  },
  disputed: {
    label: 'Disputed',
    color: 'text-[#9A4A3E]',
    bg: 'bg-[#FDF2F0]',
    border: 'border-[#B25B4E]',
    dot: 'bg-[#B25B4E]',
  },
  // Variation Notice statuses
  issued: {
    label: 'VN Issued',
    color: 'text-[#92722E]',
    bg: 'bg-[#FDF8ED]',
    border: 'border-[#C8943E]',
    dot: 'bg-[#C8943E]',
  },
  acknowledged: {
    label: 'VN Acknowledged',
    color: 'text-[#3D6B5E]',
    bg: 'bg-[#F0F7F4]',
    border: 'border-[#4A7C6F]',
    dot: 'bg-[#4A7C6F]',
  },
};

/** Format sequence number as VAR-001 */
export function formatVariationNumber(sequenceNumber: number): string {
  return `VAR-${String(sequenceNumber).padStart(3, '0')}`;
}

/** Format sequence number as VN-001 */
export function formatNoticeNumber(sequenceNumber: number): string {
  return `VN-${String(sequenceNumber).padStart(3, '0')}`;
}

/** Get variation number, falling back to sequence number if variation_number not set */
export function getVariationNumber(variation: { variation_number?: string; sequence_number: number }): string {
  return variation.variation_number ?? formatVariationNumber(variation.sequence_number);
}

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.captured;
}
