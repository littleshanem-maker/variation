'use client';

import type { StatusChange } from '@/lib/types';

interface TimelineProps {
  currentStatus: string;
  statusHistory: StatusChange[];
  responseDueDate?: string;
  revisionNumber?: number;
}

const STAGES = [
  { key: 'draft',     label: 'Draft created',       alts: ['captured'] },
  { key: 'submitted', label: 'Submitted to client',  alts: [] },
  { key: 'approved',  label: 'Approved',             alts: [] },
  { key: 'paid',      label: 'Paid',                 alts: [] },
];

const DISPUTED_STAGES = [
  { key: 'draft',     label: 'Draft created',       alts: ['captured'] },
  { key: 'submitted', label: 'Submitted to client',  alts: [] },
  { key: 'disputed',  label: 'Rejected / Disputed',  alts: ['rejected'] },
  { key: 'paid',      label: 'Paid',                 alts: [] },
];

const ORDER = ['draft', 'captured', 'submitted', 'approved', 'rejected', 'disputed', 'paid'];

function getDateForStage(stageKey: string, alts: string[], history: StatusChange[]): string | null {
  for (const sc of history) {
    if (sc.to_status === stageKey || alts.includes(sc.to_status)) {
      return sc.changed_at;
    }
  }
  return null;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDaysOverdue(dueDateStr: string): number | null {
  const due = new Date(dueDateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

export default function VariationTimeline({ currentStatus, statusHistory, responseDueDate, revisionNumber }: TimelineProps) {
  const isRejected = currentStatus === 'disputed' || currentStatus === 'rejected';
  const stages = isRejected ? DISPUTED_STAGES : STAGES;
  const currentIdx = ORDER.indexOf(currentStatus);

  return (
    <div className="bg-[#FFFCF5] rounded-md border border-[#D8D2C4] p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
      <div className="flex flex-col gap-0">
        {stages.map((stage, i) => {
          const stageIdx = ORDER.indexOf(stage.key);
          const isCurrent = currentStatus === stage.key || stage.alts.includes(currentStatus);
          const isDone = !isCurrent && currentIdx > stageIdx;
          const isFuture = !isCurrent && !isDone;

          const date = getDateForStage(stage.key, stage.alts, statusHistory);
          const overdueDays = (isCurrent && stage.key === 'submitted' && responseDueDate)
            ? getDaysOverdue(responseDueDate)
            : null;

          return (
            <div key={stage.key} className="flex items-start gap-3 relative">
              {/* Vertical connector line */}
              {i < stages.length - 1 && (
                <div
                  className="absolute left-[15px] top-[34px] bottom-[-2px] w-[2px]"
                  style={{
                    background: isDone ? '#2E7D32' : '#D8D2C4',
                  }}
                />
              )}

              {/* Circle */}
              <div
                className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[13px] font-medium flex-shrink-0 z-10"
                style={{
                  background: isDone ? '#E5F0E6' : isCurrent ? '#2E7D32' : '#F5F2EA',
                  color: isDone ? '#2E7D32' : isCurrent ? '#FFFCF5' : '#9CA3AF',
                  border: isDone ? '2px solid #2E7D32' : isCurrent ? '2px solid #2E7D32' : '2px solid #D8D2C4',
                }}
              >
                {isDone ? '✓' : i + 1}
              </div>

              {/* Label + meta */}
              <div className="pt-[4px] pb-5 min-w-0">
                <div
                  className="text-[14px] font-medium leading-tight"
                  style={{
                    color: isCurrent ? '#17212B' : isDone ? '#1F5223' : '#9CA3AF',
                  }}
                >
                  {stage.label}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {date && (
                    <span className="text-[12px]" style={{ color: isDone ? '#4B5563' : '#6B7280' }}>
                      {formatShortDate(date)}
                    </span>
                  )}
                  {isCurrent && stage.key === 'submitted' && revisionNumber != null && revisionNumber > 0 && (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-white bg-[#1B365D] px-1.5 py-0.5 rounded">
                      Rev {revisionNumber}
                    </span>
                  )}
                  {overdueDays && (
                    <span className="text-[12px] font-medium text-[#B42318]">
                      {overdueDays}d overdue
                    </span>
                  )}
                  {isFuture && !date && (
                    <span className="text-[12px] text-[#9CA3AF]">
                      {stage.key === 'approved' ? 'Awaiting response' : '—'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
