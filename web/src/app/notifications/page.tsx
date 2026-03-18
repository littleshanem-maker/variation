'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { CheckCircle, XCircle, Clock, ArrowUpRight } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadNotifications(); }, []);

  async function loadNotifications() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.replace('/login'); return; }

    // Query variations directly — approved/rejected by client via email link
    const { data } = await supabase
      .from('variations')
      .select('id, variation_number, sequence_number, title, client_approval_response, client_approval_comment, client_approved_at')
      .in('client_approval_response', ['approved', 'rejected'])
      .order('client_approved_at', { ascending: false })
      .limit(50);

    setNotifications(data || []);
    setLoading(false);
  }

  return (
    <AppShell>
      <TopBar title="Notifications" />
      <div className="p-4 md:p-8 max-w-3xl">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm gap-2">
            <Clock size={24} className="text-slate-300" />
            No client responses yet
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((v: any) => {
              const varRef = v.variation_number ?? `VAR-${String(v.sequence_number).padStart(3, '0')}`;
              const isApproved = v.client_approval_response === 'approved';
              return (
                <button
                  key={v.id}
                  onClick={() => router.push(`/variation/${v.id}`)}
                  className="w-full text-left flex items-start gap-4 px-4 py-3.5 bg-white border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isApproved
                      ? <CheckCircle size={18} className="text-emerald-500" />
                      : <XCircle size={18} className="text-rose-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-mono font-bold text-indigo-600">{varRef}</span>
                      <StatusBadge status={isApproved ? 'approved' : 'disputed'} />
                      <span className="text-[11px] text-indigo-500 font-medium">via email link</span>
                    </div>
                    <div className="text-[13px] font-medium text-slate-800 mt-0.5 truncate">{v.title}</div>
                    {v.client_approval_comment && (
                      <div className="text-[12px] text-slate-500 mt-1 italic">"{v.client_approval_comment}"</div>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <div className="text-[11px] text-slate-400">{v.client_approved_at ? formatDateTime(v.client_approved_at) : ''}</div>
                    <ArrowUpRight size={14} className="text-slate-300" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
