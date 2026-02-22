import { getStatusConfig } from '@/lib/utils';

export default function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
}
