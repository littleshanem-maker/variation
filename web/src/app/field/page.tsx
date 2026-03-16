'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusCircle, ChevronRight, Clock, Home, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useRole } from '@/lib/role';

interface RecentCapture {
  id: string;
  notice_number: string;
  event_description: string;
  project_name: string;
  status: string;
  created_at: string;
}

interface VariationSummary {
  id: string;
  title: string;
  project_name: string;
  status: string;
  sequence_number: number;
  project_id: string;
}

const noticeStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft:        { label: 'Draft',        color: 'text-slate-500',   dot: 'bg-slate-400' },
  issued:       { label: 'Issued',       color: 'text-blue-600',    dot: 'bg-blue-500' },
  acknowledged: { label: 'Acknowledged', color: 'text-emerald-600', dot: 'bg-emerald-500' },
};

const varStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft:     { label: 'Draft',     color: 'text-slate-500',   dot: 'bg-slate-400' },
  captured:  { label: 'Draft',     color: 'text-slate-500',   dot: 'bg-slate-400' },
  submitted: { label: 'Submitted', color: 'text-amber-600',   dot: 'bg-amber-500' },
  approved:  { label: 'Approved',  color: 'text-emerald-600', dot: 'bg-emerald-500' },
  rejected:  { label: 'Rejected',  color: 'text-purple-600',  dot: 'bg-purple-500' },
  disputed:  { label: 'Disputed',  color: 'text-rose-600',    dot: 'bg-rose-500' },
  paid:      { label: 'Paid',      color: 'text-emerald-700', dot: 'bg-emerald-600' },
};

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export default function FieldHome() {
  const { isField, isLoading: roleLoading, company } = useRole();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [recent, setRecent] = useState<RecentCapture[]>([]);
  const [variations, setVariations] = useState<VariationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && !isField) router.replace('/');
  }, [isField, roleLoading]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }

    const meta = session.user.user_metadata;
    setDisplayName(meta?.display_name || meta?.full_name || session.user.email?.split('@')[0] || 'Supervisor');

    const { data: projects } = await supabase
      .from('projects').select('id, name').eq('is_active', true);
    const projectMap = new Map((projects || []).map((p: any) => [p.id, p.name]));
    const activeProjectIds = new Set((projects || []).map((p: any) => p.id));

    // Recent notices — all in this company (field users see their company's notices)
    const { data: notices } = await supabase
      .from('variation_notices')
      .select('id, notice_number, event_description, project_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (notices) {
      setRecent(
        notices
          .filter((n: any) => activeProjectIds.has(n.project_id))
          .map((n: any) => ({ ...n, project_name: projectMap.get(n.project_id) || 'Project' }))
      );
    }

    // All variations — read only, no values
    const { data: vars } = await supabase
      .from('variations')
      .select('id, title, project_id, status, sequence_number')
      .order('captured_at', { ascending: false });

    if (vars) {
      setVariations(
        vars
          .filter((v: any) => activeProjectIds.has(v.project_id))
          .map((v: any) => ({ ...v, project_name: projectMap.get(v.project_id) || 'Project' }))
      );
    }

    setLoading(false);
  }

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  const firstName = displayName.split(' ')[0];

  return (
    <div className="min-h-screen bg-slate-900 pb-20">

      {/* Header — flush to top, no card */}
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center justify-between mb-8">
          <span className="text-[12px] text-slate-400 uppercase tracking-widest font-medium">{company?.name || 'Variation Shield'}</span>
          <span className="text-[12px] text-slate-500">Field</span>
        </div>
        <div className="text-[13px] text-slate-400 mb-1">Good {getTimeOfDay()}</div>
        <div className="text-[28px] font-semibold text-white tracking-tight">{firstName}</div>
      </div>

      {/* Content — white rounded top panel */}
      <div className="bg-[#F5F5F7] rounded-t-3xl min-h-screen px-4 pt-6 pb-10 space-y-6">

        {/* Capture CTA */}
        <Link href="/capture" className="block">
          <div className="bg-indigo-600 rounded-2xl px-5 py-5 flex items-center justify-between shadow-sm active:bg-indigo-700 transition-colors">
            <div>
              <div className="text-white font-semibold text-[17px]">Capture a Variation</div>
              <div className="text-indigo-200 text-[13px] mt-0.5">Record a site instruction in 60 seconds</div>
            </div>
            <PlusCircle size={30} className="text-indigo-300 flex-shrink-0" />
          </div>
        </Link>

        {/* Recent notices */}
        <div>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Recent Notices</span>
            {recent.length > 0 && <span className="text-[12px] text-slate-400">{recent.length} shown</span>}
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden divide-y divide-[#F4F4F4]">
            {recent.length === 0 ? (
              <div className="px-5 py-7 text-center">
                <div className="text-[14px] font-medium text-slate-400">No notices yet</div>
                <div className="text-[12px] text-slate-300 mt-1">Tap above to record the first one</div>
              </div>
            ) : (
              recent.map(n => {
                const sc = noticeStatusConfig[n.status] || noticeStatusConfig.draft;
                return (
                  <Link key={n.id} href={`/notice/${n.id}`} className="block">
                    <div className="px-4 py-3.5 flex items-center gap-3 active:bg-slate-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-mono font-semibold text-[#1C1C1E]">{n.notice_number}</span>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${sc.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <div className="text-[14px] font-medium text-[#1C1C1E] truncate">{n.event_description}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={10} className="text-slate-300" />
                          <span className="text-[11px] text-[#1C1C1E]">{formatRelative(n.created_at)} · {n.project_name}</span>
                        </div>
                      </div>
                      <ChevronRight size={15} className="text-slate-300 flex-shrink-0" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Variation register — read only */}
        <div>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Variation Register</span>
            <span className="text-[12px] text-slate-400">{variations.length} items · read only</span>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden divide-y divide-[#F4F4F4]">
            {variations.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <div className="text-[13px] text-slate-400">No variations yet</div>
              </div>
            ) : (
              variations.map(v => {
                const sc = varStatusConfig[v.status] || varStatusConfig.draft;
                const varNum = `VAR-${String(v.sequence_number).padStart(3, '0')}`;
                return (
                  <div key={v.id} className="px-4 py-3.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-mono font-semibold text-[#1C1C1E]">{varNum}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${sc.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </div>
                    <div className="text-[14px] font-medium text-[#1C1C1E] truncate">{v.title}</div>
                    <div className="text-[12px] text-[#1C1C1E] mt-0.5 truncate">{v.project_name}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400">Field view · {company?.name}</p>
      </div>

      {/* Bottom nav — dark to match header */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 flex items-center justify-around px-2 py-3 z-50">
        <Link href="/field" className="flex flex-col items-center gap-1 px-10 py-1">
          <Home size={20} className="text-white" />
          <span className="text-[10px] font-medium text-white">Home</span>
        </Link>
        <Link href="/settings" className="flex flex-col items-center gap-1 px-10 py-1">
          <Settings size={20} className="text-slate-400" />
          <span className="text-[10px] font-medium text-slate-400">Settings</span>
        </Link>
      </div>
    </div>
  );
}
