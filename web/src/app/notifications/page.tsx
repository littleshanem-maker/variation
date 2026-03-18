'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { CheckCircle, XCircle, Clock, ArrowUpRight } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface Notification {
  id: string;
  variation_id: string;
  variation_number: string;
  title: string;
  project_name: string;
  event: 'approved' | 'rejected' | 'disputed';
  detail?: string;
  changed_at: string;
  read: boolean;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadNotifications(); }, []);

  async function loadNotifications() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.replace('/login'); return; }

    // Fetch recent status changes from client (approved/rejected/disputed via email)
    const { data } = await supabase
      .from('status_changes')
      .select(`
        id,
        variation_id,
        to_status,
        changed_by,
        note,
        changed_at,
        variations (
          id,
          variation_number,
          sequence_number,
          title,
          projects ( name )
        )
      `)
      .in('to_status', ['approved', 'disputed'])
      .order('changed_at', { ascending: false })
      .limit(50);

    if (!data) { setLoading(false); return; }

    const notifs: Notification[] = data
      .filter((sc: any) => sc.variations)
      .map((sc: any) => {
        const v = sc.variations;
        const proj = Array.isArray(v.projects) ? v.projects[0] : v.projects;
        const varRef = v.variation_number ?? `VAR-${String(v.sequence_number).padStart(3, '0')}`;
        const event = sc.to_status === 'approved' ? 'approved' : sc.to_status === 'disputed' ? 'rejected' : sc.to_status;
        const isClientAction = sc.changed_by === 'client-email';
        return {
          id: sc.id,
          variation_id: v.id,
          variation_number: varRef,
          title: v.title,
          project_name: proj?.name ?? '',
          event,
          detail: isClientAction
            ? (sc.note || (event === 'approved' ? 'Approved via email link' : 'Rejected via email link'))
            : sc.note,
          changed_at: sc.changed_at,
          read: false, // could persist read state in future
          isClientAction,
        } as any;
      });

    setNotifications(notifs);
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
            No notifications yet
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => (
              <button
                key={n.id}
                onClick={() => router.push(`/variation/${n.variation_id}`)}
                className="w-full text-left flex items-start gap-4 px-4 py-3.5 bg-white border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {n.event === 'approved' ? (
                    <CheckCircle size={18} className="text-emerald-500" />
                  ) : (
                    <XCircle size={18} className="text-rose-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-mono font-bold text-indigo-600">{n.variation_number}</span>
                    <StatusBadge status={n.event === 'rejected' ? 'disputed' : n.event} />
                    {n.isClientAction && (
                      <span className="text-[11px] text-indigo-500 font-medium">via email link</span>
                    )}
                  </div>
                  <div className="text-[13px] font-medium text-slate-800 mt-0.5 truncate">{n.title}</div>
                  <div className="text-[12px] text-slate-400 mt-0.5">{n.project_name}</div>
                  {n.detail && n.detail !== 'Approved via email link' && n.detail !== 'Rejected via email link' && (
                    <div className="text-[12px] text-slate-500 mt-1 italic">"{n.detail}"</div>
                  )}
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <div className="text-[11px] text-slate-400">{formatDateTime(n.changed_at)}</div>
                  <ArrowUpRight size={14} className="text-slate-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
