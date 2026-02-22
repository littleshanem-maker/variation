/** Format cents as AUD dollars with commas, no cents shown */
export function formatCurrency(cents: number): string {
  const dollars = Math.round(cents / 100);
  return '$' + dollars.toLocaleString('en-AU');
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
  captured: {
    label: 'Draft',
    color: 'text-[#6B7280]',
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
};

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.captured;
}
