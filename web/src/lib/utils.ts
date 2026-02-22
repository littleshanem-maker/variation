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

/** Status display config */
export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  captured: { label: 'Draft', color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-400' },
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-500' },
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-500' },
  paid: { label: 'Paid', color: 'text-gray-900', bg: 'bg-gray-800 text-white', border: 'border-gray-800' },
  disputed: { label: 'Disputed', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-500' },
};

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.captured;
}
