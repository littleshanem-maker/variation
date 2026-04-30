import { getStatusConfig } from '@/lib/utils';

export default function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);
  return (
    <span className={`cond inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] ${config.bg} ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
