'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import type { VariationNotice } from '@/lib/types';

type NoticeWithProject = VariationNotice & { project_name: string };

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  draft:        { label: 'Draft',        bg: 'bg-slate-100',   color: 'text-slate-600',   dot: 'bg-slate-400' },
  issued:       { label: 'Issued',       bg: 'bg-indigo-50',   color: 'text-[#C75A00]',  dot: 'bg-[#E76F00]' },
  acknowledged: { label: 'Acknowledged', bg: 'bg-emerald-50',  color: 'text-emerald-700', dot: 'bg-emerald-500' },
};

function NoticeBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? STATUS_LABELS.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<NoticeWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'issued' | 'acknowledged'>('all');

  useEffect(() => {
    loadNotices();
  }, []);

  async function loadNotices() {
    const supabase = createClient();
    const { data: projects } = await supabase.from('projects').select('id, name').eq('is_active', true);
    const projectMap = new Map(projects?.map(p => [p.id, p.name]) ?? []);

    const { data } = await supabase
      .from('variation_notices')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setNotices(data.map(n => ({ ...n, project_name: projectMap.get(n.project_id) ?? 'Unknown Project' })));
    }
    setLoading(false);
  }

  const filtered = filter === 'all' ? notices : notices.filter(n => n.status === filter);

  const tabs = [
    { key: 'all',          label: 'All',           count: notices.length },
    { key: 'draft',        label: 'Draft',         count: notices.filter(n => n.status === 'draft').length },
    { key: 'issued',       label: 'Issued',        count: notices.filter(n => n.status === 'issued').length },
    { key: 'acknowledged', label: 'Acknowledged',  count: notices.filter(n => n.status === 'acknowledged').length },
  ] as const;

  return (
    <AppShell>
      <TopBar title="Variation Notices" />
      <div className="p-4 md:p-8 space-y-4 ">

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-shrink-0 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                filter === tab.key
                  ? 'bg-[#E76F00] text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-[11px] ${filter === tab.key ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-white border border-slate-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <p className="text-[14px] text-slate-400">No notices found.</p>
            <Link href="/notice/new" className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-[#E76F00] text-white text-[13px] font-medium rounded-lg">
              + New Notice
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] divide-y divide-slate-100 overflow-hidden">
            {filtered.map(notice => (
              <Link
                key={notice.id}
                href={`/notice/${notice.id}`}
                className="block px-4 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-mono font-semibold text-[#E76F00]">{notice.notice_number}</span>
                      {notice.cost_flag && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Cost</span>
                      )}
                      {notice.time_flag && (
                        <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          Time{notice.estimated_days ? ` +${notice.estimated_days}d` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-medium text-slate-800 leading-snug line-clamp-2">
                      {notice.event_description}
                    </p>
                    <p className="text-[12px] text-slate-400 mt-1">{notice.project_name} · {formatDate(notice.event_date)}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <NoticeBadge status={notice.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
