'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusCircle, FileText, ChevronRight, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useRole } from '@/lib/role';
import Logo from '@/components/Logo';

interface RecentCapture {
  id: string;
  notice_number: string;
  event_description: string;
  project_name: string;
  status: string;
  created_at: string;
}

export default function FieldHome() {
  const { isField, isLoading: roleLoading, company } = useRole();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [recent, setRecent] = useState<RecentCapture[]>([]);
  const [loading, setLoading] = useState(true);

  // Non-field users don't belong here
  useEffect(() => {
    if (!roleLoading && !isField) {
      router.replace('/');
    }
  }, [isField, roleLoading]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/login'); return; }

    // Get display name
    const meta = session.user.user_metadata;
    setDisplayName(meta?.display_name || meta?.full_name || session.user.email?.split('@')[0] || 'Supervisor');

    // Get recent notices captured by this user (last 10)
    const { data: notices } = await supabase
      .from('variation_notices')
      .select('id, notice_number, event_description, project_id, status, created_at')
      .eq('created_by', session.user.id)
      .order('created_at', { ascending: false })
      .limit(8);

    if (notices && notices.length > 0) {
      // Get project names
      const projectIds = [...new Set(notices.map((n: any) => n.project_id))];
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);
      const projectMap = new Map((projects || []).map((p: any) => [p.id, p.name]));

      setRecent(notices.map((n: any) => ({
        ...n,
        project_name: projectMap.get(n.project_id) || 'Project',
      })));
    }

    setLoading(false);
  }

  const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    draft:        { label: 'Draft',        color: 'text-slate-500',  dot: 'bg-slate-400' },
    issued:       { label: 'Issued',       color: 'text-blue-600',   dot: 'bg-blue-500' },
    acknowledged: { label: 'Acknowledged', color: 'text-emerald-600',dot: 'bg-emerald-500' },
  };

  function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
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
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <div className="bg-slate-900 px-5 pt-12 pb-8">
        <div className="flex items-center justify-between mb-6">
          <Logo size={28} />
          <div className="text-right">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">{company?.name}</div>
          </div>
        </div>
        <div>
          <div className="text-[13px] text-slate-400 mb-1">Good {getTimeOfDay()}</div>
          <div className="text-[24px] font-semibold text-white">{firstName}</div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-5">
        {/* Primary CTA */}
        <Link href="/capture" className="block">
          <div className="bg-indigo-600 rounded-2xl px-5 py-5 flex items-center justify-between shadow-sm active:bg-indigo-700 transition-colors">
            <div>
              <div className="text-white font-semibold text-[17px]">Capture a Variation</div>
              <div className="text-indigo-200 text-[13px] mt-0.5">Record a site instruction in 60 seconds</div>
            </div>
            <PlusCircle size={32} className="text-indigo-200 flex-shrink-0" />
          </div>
        </Link>

        {/* Recent captures */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[13px] font-semibold text-slate-700 uppercase tracking-wide">Recent Captures</span>
            {recent.length > 0 && (
              <span className="text-[12px] text-slate-400">{recent.length} notices</span>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] px-5 py-8 text-center">
              <FileText size={32} className="text-slate-300 mx-auto mb-3" />
              <div className="text-[14px] font-medium text-slate-500">No captures yet</div>
              <div className="text-[12px] text-slate-400 mt-1">Tap above to record your first variation notice</div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden divide-y divide-[#F0F0EE]">
              {recent.map(n => {
                const sc = statusConfig[n.status] || statusConfig.draft;
                return (
                  <Link key={n.id} href={`/notice/${n.id}`} className="block">
                    <div className="px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-mono font-semibold text-indigo-500">{n.notice_number}</span>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${sc.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <div className="text-[14px] font-medium text-slate-800 truncate">{n.event_description}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock size={11} className="text-slate-300" />
                          <span className="text-[11px] text-slate-400">{formatRelative(n.created_at)} · {n.project_name}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-[11px] text-slate-400 pb-4">
          Field view · Contact your PM for full register access
        </p>
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
