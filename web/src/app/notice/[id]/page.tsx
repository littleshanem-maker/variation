'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { printNotice, getNoticeHtmlForPdf } from '@/lib/print';
import { htmlToPdfBlob, shareOrDownloadPdf } from '@/lib/pdf';
import { getNoticeEmailMeta } from '@/lib/email';
import { useRole } from '@/lib/role';
import type { VariationNotice, Project, Variation } from '@/lib/types';

export default function NoticeDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isField, isAdmin, company } = useRole();

  const [notice, setNotice] = useState<VariationNotice | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [linkedVariation, setLinkedVariation] = useState<Variation | null>(null);
  const [loading, setLoading] = useState(true);

  const [advancing, setAdvancing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => { loadNotice(); }, [id]);

  async function loadNotice() {
    const supabase = createClient();
    const { data: n } = await supabase
      .from('variation_notices')
      .select('*')
      .eq('id', id)
      .single();

    if (!n) { setLoading(false); return; }
    setNotice(n);

    const { data: proj } = await supabase
      .from('projects')
      .select('*')
      .eq('id', n.project_id)
      .single();
    setProject(proj);

    const { data: vars } = await supabase
      .from('variations')
      .select('*')
      .eq('notice_id', id)
      .limit(1);
    if (vars && vars.length > 0) {
      setLinkedVariation(vars[0]);
    }

    setLoading(false);
  }

  async function handleIssue() {
    if (!notice) return;
    setAdvancing(true);
    const supabase = createClient();
    const { error } = await supabase.from('variation_notices').update({
      status: 'issued',
      issued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', notice.id);
    if (!error) await loadNotice();
    setAdvancing(false);
  }

  async function handleAcknowledge() {
    if (!notice) return;
    setAdvancing(true);
    const supabase = createClient();
    const { error } = await supabase.from('variation_notices').update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', notice.id);
    if (!error) await loadNotice();
    setAdvancing(false);
  }

  async function handleDelete() {
    if (!notice || !project) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from('variation_notices').delete().eq('id', notice.id);
    if (!error) {
      router.push(`/project/${project.id}`);
    } else {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function handlePrint() {
    if (notice && project) {
      printNotice(notice, project, company?.name || '');
    }
  }

  async function handleSendEmail() {
    if (!notice || !project) return;
    setSendingEmail(true);
    try {
      const { html, css } = getNoticeHtmlForPdf(notice, project, company?.name || '');
      const blob = await htmlToPdfBlob(html, css);
      const { subject, body, filename } = getNoticeEmailMeta(notice, project);
      await shareOrDownloadPdf(blob, filename, subject, body);
    } catch (err) {
      console.error('Email send failed:', err);
    } finally {
      setSendingEmail(false);
    }
  }

  if (loading) {
    return (
      <AppShell><TopBar title="Variation Notice" />
        <div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Loading...</div>
      </AppShell>
    );
  }

  if (!notice || !project) {
    return (
      <AppShell><TopBar title="Variation Notice" />
        <div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Notice not found</div>
      </AppShell>
    );
  }

  const canIssue = !isField && notice.status === 'draft';
  const canAcknowledge = !isField && notice.status === 'issued';
  const canCreateVR = !isField && notice.status === 'issued' && !linkedVariation;
  const canDelete = !isField && notice.status === 'draft';

  const labelClass = "block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1";

  return (
    <AppShell>
      <TopBar title="Variation Shield" onPrint={isField ? undefined : handlePrint} printLabel="Print Notice" />
      <div className="p-4 md:p-8 space-y-4 md:space-y-5 max-w-4xl">
        {/* Back + Actions */}
        <div className="flex flex-wrap items-start gap-2">
          <Link
            href={`/project/${project.id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors py-2 -my-2 mr-auto group"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:-translate-x-0.5 transition-transform">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to {project.name}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {canIssue && (
              <button
                onClick={handleIssue}
                disabled={advancing}
                className="px-3 py-1.5 text-[13px] font-medium text-[#92722E] border border-[#C8943E] rounded-md hover:bg-[#FDF8ED] transition-colors duration-[120ms] disabled:opacity-40 whitespace-nowrap"
              >
                {advancing ? '…' : 'Issue Notice'}
              </button>
            )}
            {canAcknowledge && (
              <button
                onClick={handleAcknowledge}
                disabled={advancing}
                className="px-3 py-1.5 text-[13px] font-medium text-[#3D6B5E] border border-[#4A7C6F] rounded-md hover:bg-[#F0F7F4] transition-colors duration-[120ms] disabled:opacity-40 whitespace-nowrap"
              >
                {advancing ? '…' : 'Mark Acknowledged'}
              </button>
            )}
            {canCreateVR && (
              <Link
                href={`/project/${project.id}?noticeId=${notice.id}&newVariation=1`}
                className="px-3 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.1)] whitespace-nowrap"
              >
                Create Variation Request
              </Link>
            )}
            {canDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 text-[13px] font-medium text-[#B25B4E] border border-[#E5E7EB] rounded-md hover:bg-[#FDF2F0] hover:border-[#B25B4E] transition-colors duration-[120ms] whitespace-nowrap"
              >
                Delete
              </button>
            )}
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="px-3 py-2.5 text-[13px] font-medium text-[#1B365D] border border-[#1B365D]/30 rounded-md hover:bg-[#F0F4FA] transition-colors duration-[120ms] disabled:opacity-50 whitespace-nowrap"
            >
              {sendingEmail ? 'Preparing...' : '📧 Send by Email'}
            </button>
          </div>
        </div>

        {/* Header Card */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="text-[12px] font-mono font-bold text-[#1B365D] uppercase tracking-wider mb-1">{notice.notice_number}</div>
              <h2 className="text-xl font-semibold text-[#1C1C1E]">Variation Notice</h2>
              <p className="text-[13px] text-[#6B7280] mt-1">{project.name} · {project.client}</p>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-0">
              <StatusBadge status={notice.status} />
              {notice.issued_at && (
                <div className="text-[12px] text-[#9CA3AF] sm:mt-2">Issued {formatDate(notice.issued_at)}</div>
              )}
              {notice.acknowledged_at && (
                <div className="text-[12px] text-[#9CA3AF] sm:mt-1">Acknowledged {formatDate(notice.acknowledged_at)}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mt-5 pt-4 md:pt-5 border-t border-[#F0F0EE]">
            <div>
              <div className={labelClass}>Event Date</div>
              <div className="text-[14px] text-[#1C1C1E]">{new Date(notice.event_date + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
            {notice.issued_by_name && (
              <div>
                <div className={labelClass}>Issued By</div>
                <div className="text-[14px] text-[#1C1C1E]">{notice.issued_by_name}</div>
                {notice.issued_by_email && (
                  <div className="text-[12px] text-[#6B7280] mt-0.5 break-all">{notice.issued_by_email}</div>
                )}
              </div>
            )}
            {notice.contract_clause && (
              <div>
                <div className={labelClass}>Contract Clause</div>
                <div className="text-[14px] text-[#1C1C1E]">{notice.contract_clause}</div>
              </div>
            )}
          </div>
        </div>

        {/* Event Description */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-3">Description of Event</h3>
          <p className="text-[14px] text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">{notice.event_description}</p>
        </div>

        {/* Implications Card */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Implications</h3>
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <div>
              <div className={labelClass}>Cost Implication</div>
              <div className={`text-[14px] font-medium ${notice.cost_flag ? 'text-[#92722E]' : 'text-[#6B7280]'}`}>
                {notice.cost_flag ? '✓ Yes' : '✗ No'}
              </div>
            </div>
            <div>
              <div className={labelClass}>Time Implication</div>
              <div className={`text-[14px] font-medium ${notice.time_flag ? 'text-[#92722E]' : 'text-[#6B7280]'}`}>
                {notice.time_flag ? '✓ Yes' : '✗ No'}
              </div>
            </div>
            {notice.time_flag && notice.estimated_days != null && (
              <div>
                <div className={labelClass}>Estimated Days</div>
                <div className="text-[14px] text-[#1C1C1E]">{notice.estimated_days} day{notice.estimated_days !== 1 ? 's' : ''}</div>
              </div>
            )}
          </div>
        </div>

        {/* Linked Variation Request */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-3">Linked Variation Request</h3>
          {linkedVariation ? (
            <Link
              href={`/variation/${linkedVariation.id}`}
              className="flex items-center justify-between p-3 bg-[#F8F8F6] rounded-md hover:bg-[#F0F0EE] transition-colors duration-[120ms]"
            >
              <div>
                <div className="text-[13px] font-mono font-bold text-[#1B365D]">
                  {linkedVariation.variation_number ?? `VAR-${String(linkedVariation.sequence_number).padStart(3, '0')}`}
                </div>
                <div className="text-[14px] font-medium text-[#1C1C1E] mt-0.5">{linkedVariation.title}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <StatusBadge status={linkedVariation.status} />
                <span className="text-[12px] text-[#1B365D] font-medium">View →</span>
              </div>
            </Link>
          ) : (
            <div className="text-[14px] text-[#9CA3AF]">
              No Variation Request has been created from this notice yet.
              {canCreateVR && (
                <Link
                  href={`/project/${project.id}?noticeId=${notice.id}&newVariation=1`}
                  className="ml-2 text-[#1B365D] font-medium hover:text-[#24466F] transition-colors"
                >
                  Create one →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-t-xl sm:rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-2">Delete Notice</h3>
            <p className="text-[14px] text-[#6B7280] mb-1">
              Are you sure you want to delete <span className="font-medium text-[#1C1C1E]">{notice.notice_number}</span>?
            </p>
            <p className="text-[13px] text-[#9CA3AF] mb-5">This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-3 py-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors duration-[120ms] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#B25B4E] rounded-md hover:bg-[#9E4D41] disabled:opacity-40 transition-colors duration-[120ms]"
              >
                {deleting ? 'Deleting...' : 'Delete Notice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
