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
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

/** Status display config — desaturated, sophisticated tones */
export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft: {
    label: 'Draft',
    color: 'text-[#334155]',
    bg: 'bg-[#F5F2EA]',
    border: 'border-[#D8D2C4]',
    dot: 'bg-[#4B5563]',
  },
  captured: {
    // Legacy alias for draft — backward compat
    label: 'Draft',
    color: 'text-[#334155]',
    bg: 'bg-[#F5F2EA]',
    border: 'border-[#D8D2C4]',
    dot: 'bg-[#4B5563]',
  },
  submitted: {
    label: 'Submitted',
    color: 'text-[#8C6500]',
    bg: 'bg-[#FBF1D6]',
    border: 'border-[#8C6500]',
    dot: 'bg-[#8C6500]',
  },
  approved: {
    label: 'Approved',
    color: 'text-[#1F5223]',
    bg: 'bg-[#E5F0E6]',
    border: 'border-[#D8D2C4]',
    dot: 'bg-[#2E7D32]',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-[#334155]',
    bg: 'bg-[#F5F2EA]',
    border: 'border-[#334155]',
    dot: 'bg-[#334155]',
  },
  paid: {
    label: 'Paid',
    color: 'text-[#1F5223]',
    bg: 'bg-[#E5F0E6]',
    border: 'border-[#D8D2C4]',
    dot: 'bg-[#2E7D32]',
  },
  disputed: {
    label: 'Disputed',
    color: 'text-[#7A1810]',
    bg: 'bg-[#FBE6E4]',
    border: 'border-[#D8D2C4]',
    dot: 'bg-[#B42318]',
  },
  // Variation Notice statuses
  issued: {
    label: 'VN issued',
    color: 'text-[#8C6500]',
    bg: 'bg-[#FBF1D6]',
    border: 'border-[#8C6500]',
    dot: 'bg-[#8C6500]',
  },
  acknowledged: {
    label: 'VN acknowledged',
    color: 'text-[#1F5223]',
    bg: 'bg-[#E5F0E6]',
    border: 'border-[#2E7D32]',
    dot: 'bg-[#2E7D32]',
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

/** Get variation number, falling back to sequence number if variation_number not set.
 *  Always shows Rev N suffix when revision_number > 0, regardless of status. */
export function getVariationNumber(variation: { variation_number?: string; sequence_number: number; revision_number?: number; status?: string }): string {
  const base = variation.variation_number ?? formatVariationNumber(variation.sequence_number);
  const rev = variation.revision_number ?? 0;
  return rev > 0 ? `${base} Rev ${rev}` : base;
}

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.captured;
}
