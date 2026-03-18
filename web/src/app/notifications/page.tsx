'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase';
import { CheckCircle, XCircle, Clock, ArrowUpRight } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

const SEEN_KEY = 'vs_seen_notifications';

function getSeenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
  catch { return new Set(); }
}

function markSeen(ids: string[]) {
  const seen = getSeenIds();
  ids.forEach(id => seen.add(id));
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadNotifications(); }, []);

  async function loadNotifications() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.replace('/login'); return; }

    const { data } = await supabase
      .from('variations')
      .select('id, variation_number, sequence_number, title, client_approval_response, client_approval_comment, client_approved_at, projects(name)')
      .in('client_approval_response', ['approved', 'rejected'])
      .order('client_approved_at', { ascending: false })
      .limit(50);

    const seen = getSeenIds();
    // Only show unseen
    setNotifications((data || []).filter((v: any) => !seen.has(v.id)));
    setLoading(false);
  }

  function handleClick(v: any) {
    markSeen([v.id]);
    setNotifications(prev => prev.filter(n => n.id !== v.id));
    router.push(`/variation/${v.id}`);
  }

  function handleMarkAllSeen() {
    markSeen(notifications.map(n => n.id));
    setNotifications([]);
  }

  return (
    <AppShell>
      <TopBar title="Notifications" />
      <div className="p-4 md:p-8 ">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm gap-2">
            <Clock size={24} className="text-slate-300" />
            All caught up
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] text-slate-500">{notifications.length} unseen</p>
              <button
                onClick={handleMarkAllSeen}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <CheckCircle size={13} className="text-emerald-500" /> Mark all as seen
              </button>
            </div>
            <div className="space-y-2">
              {notifications.map((v: any) => {
                const varRef = v.variation_number ?? `VAR-${String(v.sequence_number).padStart(3, '0')}`;
                const isApproved = v.client_approval_response === 'approved';
                const proj = Array.isArray(v.projects) ? v.projects[0] : v.projects;
                return (
                  <button
                    key={v.id}
                    onClick={() => handleClick(v)}
                    className="w-full text-left flex items-start gap-4 px-4 py-3.5 bg-white border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {isApproved
                        ? <CheckCircle size={18} className="text-emerald-500" />
                        : <XCircle size={18} className="text-rose-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-mono font-bold text-[#1C1C1E]">{varRef}</span>
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isApproved ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                          {isApproved ? 'Approved' : 'Disputed'}
                        </span>
                        <span className="text-[11px] text-slate-400">via email link</span>
                      </div>
                      <div className="text-[13px] font-semibold text-[#1C1C1E] mt-0.5 truncate">{v.title}</div>
                      {proj?.name && (
                        <div className="text-[12px] text-[#1C1C1E] mt-0.5">{proj.name}</div>
                      )}
                      {v.client_approval_comment && (
                        <div className="text-[12px] text-slate-500 mt-1 italic">"{v.client_approval_comment}"</div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <div className="text-[11px] text-[#1C1C1E]">{v.client_approved_at ? formatDateTime(v.client_approved_at) : ''}</div>
                      <ArrowUpRight size={14} className="text-slate-300" />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
