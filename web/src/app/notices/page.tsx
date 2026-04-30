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
  draft:        { label: 'Draft',        bg: 'bg-[#F5F2EA]',   color: 'text-[#334155]',   dot: 'bg-[#4B5563]' },
  issued:       { label: 'Issued',       bg: 'bg-[#F5F2EA]',   color: 'text-[#9A3F00]',  dot: 'bg-[#B84C00]' },
  acknowledged: { label: 'Acknowledged', bg: 'bg-[#E5F0E6]',  color: 'text-[#1F5223]', dot: 'bg-[#2E7D32]' },
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
                  ? 'bg-[#B84C00] text-[#FFFCF5]'
                  : 'bg-[#FFFCF5] text-[#334155] border border-[#D8D2C4] hover:bg-[#F5F2EA]'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-[11px] ${filter === tab.key ? 'text-[#FFFCF5]' : 'text-[#4B5563]'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-[#FFFCF5] border border-[#D8D2C4] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#FFFCF5] rounded-lg border border-[#D8D2C4] p-12 text-center">
            <p className="text-[14px] text-[#4B5563]">No notices found.</p>
            <Link href="/notice/new" className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-[#B84C00] text-[#FFFCF5] text-[13px] font-medium rounded-lg">
              + New Notice
            </Link>
          </div>
        ) : (
          <div className="bg-[#FFFCF5] rounded-lg border border-[#D8D2C4] shadow-[0_1px_2px_rgba(17,24,39,0.04)] divide-y divide-[#D8D2C4] overflow-hidden">
            {filtered.map(notice => (
              <Link
                key={notice.id}
                href={`/notice/${notice.id}`}
                className="block px-4 py-3.5 hover:bg-[#F5F2EA] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] mono font-medium text-[#B84C00]">{notice.notice_number}</span>
                      {notice.cost_flag && (
                        <span className="text-[10px] font-medium text-[#8C6500] bg-[#FBF1D6] px-1.5 py-0.5 rounded">Cost</span>
                      )}
                      {notice.time_flag && (
                        <span className="text-[10px] font-medium text-[#B84C00] bg-[#F5F2EA] px-1.5 py-0.5 rounded">
                          Time{notice.estimated_days ? ` +${notice.estimated_days}d` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-medium text-[#111827] leading-snug line-clamp-2">
                      {notice.event_description}
                    </p>
                    <p className="text-[12px] text-[#4B5563] mt-1">{notice.project_name} · {formatDate(notice.event_date)}</p>
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
