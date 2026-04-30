'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { Send, FileText, CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { printNotice, getNoticeHtmlForPdf } from '@/lib/print';
import { htmlToPdfBlob, shareOrDownloadPdf } from '@/lib/pdf';
import { getNoticeEmailMeta } from '@/lib/email';
import { useRole } from '@/lib/role';
import type { VariationNotice, Project, Variation, Document, NoticeRevision } from '@/lib/types';
import CostItemsTable, { type CostItem } from '@/components/CostItemsTable';
import EmailAutocomplete from '@/components/EmailAutocomplete';

export default function NoticeDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isField, isAdmin, company } = useRole();

  const [notice, setNotice] = useState<VariationNotice | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [linkedVariation, setLinkedVariation] = useState<Variation | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sender, setSender] = useState<{ name: string; email: string }>({ name: '', email: '' });

  const [advancing, setAdvancing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClientWarning, setShowClientWarning] = useState<'edit' | 'delete' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editEventDate, setEditEventDate] = useState('');
  const [editContractClause, setEditContractClause] = useState('');
  const [editIssuedByName, setEditIssuedByName] = useState('');
  const [editIssuedByEmail, setEditIssuedByEmail] = useState('');
  const [editTimeFlag, setEditTimeFlag] = useState(false);
  const [editTimeDays, setEditTimeDays] = useState('');
  const [editTimeUnit, setEditTimeUnit] = useState<'days' | 'hours'>('days');
  const [editCostFlag, setEditCostFlag] = useState(false);
  const [editCostItems, setEditCostItems] = useState<CostItem[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendStage, setSendStage] = useState<'idle' | 'pdf' | 'sending'>('idle');
  const [hasPendingDraft, setHasPendingDraft] = useState(false);
  // Inline client email entry for Send to Client
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [clientEmailInput, setClientEmailInput] = useState('');
  const [ccEmailInput, setCcEmailInput] = useState('');
  // Revision history
  const [revisions, setRevisions] = useState<NoticeRevision[]>([]);
  const [generatingRevPdf, setGeneratingRevPdf] = useState<number | null>(null);

  useEffect(() => { loadNotice(); }, [id]);

  async function loadNotice() {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setSender({
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        email: user.email || '',
      });
    }

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

    // Fetch notice attachments
    const { data: docs } = await supabase
      .from('documents')
      .select('*')
      .eq('notice_id', id)
      .order('uploaded_at');
    setDocuments(docs || []);

    if (docs && docs.length > 0) {
      const urls: Record<string, string> = {};
      for (const doc of docs) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 3600);
        if (data?.signedUrl) urls[doc.id] = data.signedUrl;
      }
      setDocUrls(urls);
    }

    // Load revision history
    const { data: revData } = await supabase
      .from('notice_revisions')
      .select('*')
      .eq('notice_id', id)
      .order('revision_number', { ascending: false });
    setRevisions(revData || []);

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
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase.from('variation_notices').delete().eq('id', notice.id);
    if (!error) {
      router.push(`/project/${project.id}`);
    } else {
      setDeleting(false);
      setDeleteError('Delete failed. You may not have permission, or the notice could not be removed.');
    }
  }

  function startEditing() {
    if (!notice) return;
    setEditDescription(notice.event_description || '');
    setEditEventDate(notice.event_date || '');
    setEditContractClause(notice.contract_clause || '');
    setEditIssuedByName(notice.issued_by_name || '');
    setEditIssuedByEmail(notice.issued_by_email || '');
    setEditTimeFlag(notice.time_flag || false);
    setEditTimeDays(notice.estimated_days != null ? String(notice.estimated_days) : '');
    setEditTimeUnit((notice.time_implication_unit as 'days' | 'hours') || 'days');
    setEditCostFlag(notice.cost_flag || false);
    setEditCostItems((notice.cost_items as CostItem[]) || []);
    setNewFiles([]);
    setSaveError(null);
    setEditing(true);
    setHasPendingDraft(true);
  }

  async function handleSaveEdit() {
    if (!notice) return;
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const { error } = await supabase.from('variation_notices').update({
      event_description: editDescription.trim(),
      event_date: editEventDate,
      contract_clause: editContractClause.trim() || null,
      issued_by_name: editIssuedByName.trim() || null,
      issued_by_email: editIssuedByEmail.trim() || null,
      time_flag: editTimeFlag,
      estimated_days: editTimeFlag && editTimeDays ? parseFloat(editTimeDays) : null,
      time_implication_unit: editTimeUnit,
      cost_flag: editCostFlag,
      cost_items: editCostFlag ? editCostItems : [],
      // If already issued/acknowledged, revert to draft so Draft badge persists on reload
      status: (notice.status === 'issued' || notice.status === 'acknowledged') ? 'draft' : notice.status,
      updated_at: new Date().toISOString(),
    }).eq('id', notice.id);
    if (error) {
      setSaveError('Save failed. Please try again.');
      setSaving(false);
    } else {
      // Upload new files
      if (newFiles.length > 0) {
        const { data: { user: upUser } } = await supabase.auth.getUser();
        for (const file of newFiles) {
          const docId = crypto.randomUUID();
          const ext = file.name.split('.').pop() || 'bin';
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `${upUser!.id}/documents/${docId}/${safeName}`;
          const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, file, { contentType: file.type });
          if (!uploadErr) {
            const { error: docErr } = await supabase.from('documents').insert({
              id: docId,
              notice_id: notice.id,
              file_name: file.name,
              file_type: file.type || `application/${ext}`,
              file_size: file.size,
              storage_path: storagePath,
              uploaded_at: new Date().toISOString(),
            });
            if (docErr) console.error('Doc insert error:', docErr);
          } else {
            console.error('Upload error:', uploadErr);
          }
        }
        setNewFiles([]);
      }
      setEditing(false);
      setSaving(false);
      // Reload
      const { data } = await supabase.from('variation_notices').select('*').eq('id', notice.id).single();
      if (data) setNotice(data as VariationNotice);
      // Reload docs
      await loadNotice();
    }
  }

  async function handleConvertToVar() {
    if (!notice || !project) return;
    setConverting(true);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setConverting(false); return; }

    // Get next VAR sequence number for this project
    const { data: existing } = await supabase
      .from('variations')
      .select('sequence_number')
      .eq('project_id', notice.project_id)
      .order('sequence_number', { ascending: false })
      .limit(1);

    const nextSeq = existing && existing.length > 0 ? existing[0].sequence_number + 1 : 1;

    // Auto-generate title from event description (first 80 chars)
    const autoTitle = notice.event_description.slice(0, 80);

    const varId = crypto.randomUUID();
    const { error } = await supabase.from('variations').insert({
      id: varId,
      project_id: notice.project_id,

      sequence_number: nextSeq,
      title: autoTitle,
      description: notice.event_description,
      instruction_source: 'other',
      instructed_by: notice.issued_by_name || null,
      estimated_value: notice.cost_items
        ? (notice.cost_items as any[]).reduce((s: number, i: any) => s + (i.total || 0), 0) * 100
        : 0,
      cost_items: notice.cost_items || [],
      time_implication_unit: notice.time_implication_unit || 'days',
      eot_days_claimed: notice.estimated_days || null,
      status: 'draft',
      captured_at: notice.event_date
        ? new Date(notice.event_date + 'T00:00:00').toISOString()
        : new Date().toISOString(),
      requestor_name: notice.issued_by_name || null,
      requestor_email: notice.issued_by_email || session.user.email,
      notice_id: notice.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Convert to VAR failed:', error);
      alert('Failed to create Variation Request: ' + error.message);
      setConverting(false);
      return;
    }

    // Copy notice documents to the new variation so they appear on the VR
    if (documents.length > 0) {
      for (const doc of documents) {
        await supabase.from('documents').insert({
          id: crypto.randomUUID(),
          variation_id: varId,
          notice_id: doc.notice_id,
          file_name: doc.file_name,
          file_type: doc.file_type,
          file_size: doc.file_size,
          storage_path: doc.storage_path,
          uploaded_at: doc.uploaded_at,
        });
      }
    }

    // Navigate to the new variation in edit mode so user can fill in value + details
    router.push(`/variation/${varId}?edit=1`);
  }

  const noticeCompanyInfo = { logoUrl: company?.logo_url, abn: company?.abn, address: company?.address, phone: company?.phone, preferredStandard: company?.preferred_standard };

  function handlePrint() {
    if (notice && project) {
      printNotice(notice, project, company?.name || '', sender, noticeCompanyInfo, documents, docUrls);
    }
  }

  async function handleSendToClient(toOverride?: string, ccOverride?: string) {
    if (!notice || !project) return;
    const toEmail = toOverride || notice.client_email || '';
    const ccEmail = ccOverride ?? ccEmailInput;
    if (!toEmail) { setShowEmailInput(true); return; }

    setSendingEmail(true);
    setSaveError(null);
    setSendStage('pdf');
    try {
      const supabase = createClient();

      // New revision = count of existing snapshots (0 snapshots = Rev 0, 1 = Rev 1, etc.)
      const { count: revCount } = await supabase
        .from('notice_revisions')
        .select('id', { count: 'exact', head: true })
        .eq('notice_id', notice.id);

      const newRevision = revCount ?? 0;

      // Always save revision_number + client emails
      const updatePayload: Record<string, unknown> = {
        client_email: toEmail,
        cc_emails: ccEmail || null,
        revision_number: newRevision,
      };
      await supabase.from('variation_notices').update(updatePayload).eq('id', notice.id);
      setNotice(prev => prev ? { ...prev, client_email: toEmail, cc_emails: ccEmail || undefined, revision_number: newRevision } : prev);

      // Snapshot this revision
      const { error: revInsertError } = await supabase.from('notice_revisions').insert({
        notice_id: notice.id,
        revision_number: newRevision,
        event_description: notice.event_description,
        event_date: notice.event_date,
        contract_clause: notice.contract_clause,
        issued_by_name: notice.issued_by_name,
        issued_by_email: notice.issued_by_email,
        time_flag: notice.time_flag,
        estimated_days: notice.estimated_days,
        time_implication_unit: notice.time_implication_unit,
        cost_flag: notice.cost_flag,
        cost_items: notice.cost_items,
        sent_to: toEmail,
        sent_cc: ccEmail || null,
        sent_at: new Date().toISOString(),
      });
      if (revInsertError) {
        console.error('[notice revision insert error]', revInsertError);
        throw new Error(`Revision save failed: ${revInsertError.message}`);
      }

      // Generate PDF — patch status and revision_number to match what was sent
      const noticeForPdf = { ...notice, status: 'issued', revision_number: newRevision, issued_at: new Date().toISOString() };
      let pdfBase64: string | null = null;
      try {
        const { html, css } = getNoticeHtmlForPdf(noticeForPdf as typeof notice, project, company?.name || '', sender, noticeCompanyInfo, documents, docUrls);
        const pdfAttachmentUrls = documents
          .filter(d => d.file_type === 'application/pdf' && docUrls[d.id])
          .map(d => docUrls[d.id]);
        const blob = await htmlToPdfBlob(html, css, pdfAttachmentUrls);
        const reader = new FileReader();
        pdfBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch { pdfBase64 = null; }

      setSendStage('sending');
      const updatedNotice = { ...notice, revision_number: newRevision };
      const { subject, filename } = getNoticeEmailMeta(updatedNotice, project);
      // TO: split comma-separated into array
      const toList = toEmail.split(',').map(e => e.trim()).filter(Boolean);
      const ccList = ccEmail ? ccEmail.split(',').map(e => e.trim()).filter(Boolean) : [];
      const res = await fetch('/api/send-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noticeId: notice.id,
          toEmails: toList,
          ccEmails: ccList,
          pdfBase64,
          filename,
          subject,
          companyName: company?.name || '',
          senderEmail: sender.email,
          senderName: sender.name,
          noticeNumber: notice.notice_number,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Send failed (${res.status})`);
      }

      // Mark as issued if still draft
      if (notice.status === 'draft') await handleIssue();

      setShowEmailInput(false);
      setClientEmailInput('');
      setCcEmailInput('');
      setHasPendingDraft(false);
      const toList2 = toEmail.split(',').map(e => e.trim()).filter(Boolean);
      const sentTo = toList2.length > 1 ? `${toList2.length} recipients` : toList2[0];
      setSuccessMsg(`Email sent to ${sentTo}${pdfBase64 ? ' with PDF' : ''}`);
      setTimeout(() => setSuccessMsg(null), 5000);

      // Save sent emails to client_contacts for autofill
      if (company?.id) {
        const supabase = createClient();
        const ccList2 = ccEmail ? ccEmail.split(',').map(e => e.trim()).filter(Boolean) : [];
        const allSent = [...toList2, ...ccList2];
        for (const email of allSent) {
          if (!email || !email.includes('@')) continue;
          const cleanEmail = email.toLowerCase().trim();
          const { data: existing } = await supabase.from('client_contacts').select('id, use_count').eq('company_id', company.id).eq('email', cleanEmail).single();
          if (existing) {
            await supabase.from('client_contacts').update({ use_count: (existing.use_count || 1) + 1, last_used: new Date().toISOString() }).eq('id', existing.id);
          } else {
            await supabase.from('client_contacts').insert({ company_id: company.id, email: cleanEmail, use_count: 1, last_used: new Date().toISOString() });
          }
        }
      }

      // Reload full notice + revision list so state is always fresh from DB
      await loadNotice();
    } catch (err) {
      console.error('Send to client failed:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to send. Please try again.');
    } finally {
      setSendingEmail(false);
      setSendStage('idle');
    }
  }

  async function handleSendEmail() {
    if (!notice || !project) return;
    setSendingEmail(true);
    try {
      const { html, css } = getNoticeHtmlForPdf(notice, project, company?.name || '', sender, noticeCompanyInfo, documents, docUrls);
      const blob = await htmlToPdfBlob(html, css);
      const { subject, body, filename } = getNoticeEmailMeta(notice, project);
      const attachmentUrls = documents
        .filter(d => !d.file_type.startsWith('image/') && docUrls[d.id])
        .map(d => ({ url: docUrls[d.id], filename: d.file_name, mimeType: d.file_type }));
      await shareOrDownloadPdf(blob, filename, subject, body, attachmentUrls);
    } catch (err) {
      console.error('Email send failed:', err);
      setSaveError('PDF generation failed. Try reducing the number of photos, or try again.');
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleDownloadPdf() {
    if (!notice || !project) return;
    setSendingEmail(true);
    try {
      const { html, css } = getNoticeHtmlForPdf(notice, project, company?.name || '', sender, noticeCompanyInfo, documents, docUrls);
      const pdfAttachmentUrls = documents
        .filter(d => d.file_type === 'application/pdf' && docUrls[d.id])
        .map(d => docUrls[d.id]);
      const blob = await htmlToPdfBlob(html, css, pdfAttachmentUrls);
      const { filename } = getNoticeEmailMeta(notice, project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('PDF download failed:', err);
      setSaveError('PDF generation failed. Try reducing the number of photos, or try again.');
    } finally {
      setSendingEmail(false);
    }
  }

  if (loading) {
    return (
      <AppShell><TopBar title="Variation Notice" />
        <div className="flex items-center justify-center h-96 text-[#64748B] text-sm">Loading...</div>
      </AppShell>
    );
  }

  if (!notice || !project) {
    return (
      <AppShell><TopBar title="Variation Notice" />
        <div className="flex items-center justify-center h-96 text-[#64748B] text-sm">Notice not found</div>
      </AppShell>
    );
  }

  const canIssue = !isField && notice.status === 'draft';
  const canAcknowledge = !isField && notice.status === 'issued';
  const canCreateVR = !isField && notice.status === 'issued' && !linkedVariation;
  const canDelete = !isField && !linkedVariation;
  // True when sent to client and still awaiting acknowledgement
  const awaitingClientResponse = notice.status === 'issued' && !!notice.client_email && !notice.acknowledged_at;

  const labelClass = "block text-[11px] font-medium text-[#64748B] uppercase tracking-[0.02em] mb-1";

  return (
    <AppShell>
      <TopBar title="Variation Notice" />
      <div className="p-4 md:p-8 space-y-4 md:space-y-5 ">
        {/* Back + Actions */}
        <div className="space-y-3">
          <Link
            href={`/project/${project.id}`}
            className="hidden md:flex items-center gap-2 w-full bg-white border border-[#D8D2C4] rounded-md px-4 py-3 text-[14px] font-semibold text-[#17212B] hover:bg-[#F0F4FA] active:bg-[#E8EFF8] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.04)] truncate"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="truncate">Back to {project.name}</span>
          </Link>
          {successMsg && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-md px-4 py-2.5 text-[13px] font-medium">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 4.5L6.5 11.5L3 8" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {successMsg}
            </div>
          )}
          {saveError && !editing && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-2.5 text-[13px] font-medium">
              ⚠️ {saveError}
            </div>
          )}
          {!editing && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Submit to Client — opens email form, or sends if form already open */}
                {!isField && (
                  <button
                    onClick={() => {
                      if (showEmailInput && clientEmailInput.trim()) {
                        // Form already open — act as Send
                        handleSendToClient(clientEmailInput.trim(), ccEmailInput.trim());
                      } else {
                        setClientEmailInput(notice?.client_email || '');
                        setCcEmailInput(notice?.cc_emails || '');
                        setShowEmailInput(true);
                      }
                    }}
                    disabled={sendingEmail}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-[#E76F00] hover:bg-[#C75A00] rounded-lg transition-colors disabled:opacity-40 shadow-sm whitespace-nowrap"
                  >
                    <Send size={14} />
                    {sendStage === 'pdf' ? 'Building PDF…' : sendStage === 'sending' ? 'Sending…' : showEmailInput ? 'Send' : 'Submit to Client'}
                  </button>
                )}
                {/* PDF */}
                <button
                  onClick={handleDownloadPdf}
                  disabled={sendingEmail}
                  className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <FileText size={14} />
                  {sendingEmail && sendStage === 'idle' ? 'Building…' : 'PDF'}
                </button>
                {/* Edit */}
                {!isField && (
                  <button
                    onClick={() => awaitingClientResponse ? setShowClientWarning('edit') : startEditing()}
                    className="px-3 py-2 text-[13px] font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Edit
                  </button>
                )}
                {/* Mark as Acknowledged by Client */}
                {canAcknowledge && (
                  <button
                    onClick={handleAcknowledge}
                    disabled={advancing}
                    className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-40 whitespace-nowrap"
                  >
                    <CheckCircle size={14} /> {advancing ? '…' : 'Mark as Acknowledged by Client'}
                  </button>
                )}
                {notice.status === 'acknowledged' && (
                  <button disabled className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg opacity-80 cursor-default whitespace-nowrap">
                    <CheckCircle size={14} /> Acknowledged by Client
                  </button>
                )}
                {/* Delete */}
                {canDelete && (
                  <button
                    onClick={() => awaitingClientResponse ? setShowClientWarning('delete') : setShowDeleteConfirm(true)}
                    className="px-3 py-2 text-[13px] font-medium text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 transition-colors whitespace-nowrap"
                  >
                    Delete
                  </button>
                )}
                {/* Refresh */}
                {!isField && (
                  <button onClick={() => window.location.reload()} className="px-3 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap">
                    Refresh
                  </button>
                )}
              </div>
              {/* Inline client email input */}
              {showEmailInput && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <EmailAutocomplete
                    value={clientEmailInput}
                    onChange={setClientEmailInput}
                    placeholder="client@company.com, engineer@company.com"
                    autoFocus
                    companyId={company?.id || null}
                    label="To"
                    labelSuffix="(comma-separate multiple)"
                  />
                  <EmailAutocomplete
                    value={ccEmailInput}
                    onChange={setCcEmailInput}
                    onKeyDown={e => { if (e.key === 'Enter' && clientEmailInput.trim()) handleSendToClient(clientEmailInput.trim(), ccEmailInput.trim()); }}
                    placeholder="you@yourcompany.com"
                    companyId={company?.id || null}
                    label="CC"
                    labelSuffix="(optional — internal team)"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => { setShowEmailInput(false); setClientEmailInput(''); setCcEmailInput(''); }} className="text-[13px] text-slate-400 hover:text-slate-600">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {editing && (
            <div className="space-y-3">
            {/* File attachments */}
            <div>
              <div
                className="w-full px-3 py-3 border border-dashed border-[#D1D5DB] rounded-md text-center cursor-pointer hover:border-[#17212B] hover:bg-[#F8FAFC] transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic"
                  onChange={e => { if (e.target.files) setNewFiles(prev => [...prev, ...Array.from(e.target.files!)]); }}
                />
                <p className="text-[13px] text-[#334155]">📎 Attach photos or files</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">PDF, Word, Excel, Images</p>
              </div>
              {newFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {newFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-[#F5F2EA] rounded text-[13px]">
                      <span className="text-[#111827] truncate">{f.name}</span>
                      <button type="button" onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))} className="text-[#64748B] hover:text-rose-500 ml-2">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {saveError && <p className="text-[13px] text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{saveError}</p>}
              <button
                onClick={() => { setEditing(false); setSaveError(null); }}
                className="px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editDescription.trim()}
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#17212B] rounded-lg hover:bg-[#334155] disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
            </div>
          )}
        </div>



        {/* Header Card */}
        <div className="bg-white rounded-md border border-[#D8D2C4] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="text-[12px] font-mono font-bold text-[#17212B] uppercase tracking-wider mb-1 flex items-center gap-2 flex-wrap">
                {notice.notice_number}
                {editing ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-[#E76F00] px-1.5 py-0.5 rounded">
                    {revisions.length > 0 ? `Rev ${revisions.length} — Draft` : 'Draft'}
                  </span>
                ) : (notice.status === 'draft' || hasPendingDraft) ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    {hasPendingDraft && revisions.length > 0 ? `Rev ${revisions.length} — Draft` : 'Draft'}
                  </span>
                ) : (notice.revision_number ?? 0) > 0 ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-[#17212B] px-1.5 py-0.5 rounded">
                    Rev {notice.revision_number}
                  </span>
                ) : null}
              </div>
              <h2 className="text-xl font-semibold text-[#111827]">Variation Notice</h2>
              <p className="text-[13px] text-[#334155] mt-1">{project.name} · {project.client}</p>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-0">
              <StatusBadge status={notice.status} />
              {notice.issued_at && <div className="text-[12px] text-[#64748B] sm:mt-2">Issued {formatDate(notice.issued_at)}</div>}
              {notice.acknowledged_at && <div className="text-[12px] text-[#64748B] sm:mt-1">Acknowledged {formatDate(notice.acknowledged_at)}</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mt-5 pt-4 md:pt-5 border-t border-[#E7E0D2]">
            {editing ? (
              <>
                <div>
                  <label className={labelClass}>Event Date</label>
                  <input type="date" value={editEventDate} onChange={e => setEditEventDate(e.target.value)} className="w-full px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md focus:ring-1 focus:ring-[#17212B] focus:border-[#17212B] outline-none" />
                </div>
                <div>
                  <label className={labelClass}>Issued By Name</label>
                  <input type="text" value={editIssuedByName} onChange={e => setEditIssuedByName(e.target.value)} className="w-full px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md focus:ring-1 focus:ring-[#17212B] outline-none" />
                </div>
                <div>
                  <label className={labelClass}>Issued By Email</label>
                  <input type="email" value={editIssuedByEmail} onChange={e => setEditIssuedByEmail(e.target.value)} className="w-full px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md focus:ring-1 focus:ring-[#17212B] outline-none" />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelClass}>Contract Clause</label>
                  <input type="text" value={editContractClause} onChange={e => setEditContractClause(e.target.value)} className="w-full px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md focus:ring-1 focus:ring-[#17212B] outline-none" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className={labelClass}>Event Date</div>
                  <div className="text-[14px] text-[#111827]">{new Date(notice.event_date + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                {notice.issued_by_name && (
                  <div>
                    <div className={labelClass}>Issued By</div>
                    <div className="text-[14px] text-[#111827]">{notice.issued_by_name}</div>
                    {notice.issued_by_email && <div className="text-[12px] text-[#334155] mt-0.5 break-all">{notice.issued_by_email}</div>}
                  </div>
                )}
                {notice.contract_clause && (
                  <div>
                    <div className={labelClass}>Contract Clause</div>
                    <div className="text-[14px] text-[#111827]">{notice.contract_clause}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Event Description */}
        <div className="bg-white rounded-md border border-[#D8D2C4] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#111827] mb-3">Description of Event</h3>
          {editing ? (
            <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={5} className="w-full px-3 py-2.5 text-[14px] border border-[#D8D2C4] rounded-md focus:ring-1 focus:ring-[#17212B] outline-none resize-none" />
          ) : (
            <p className="text-[14px] text-[#111827] leading-relaxed whitespace-pre-wrap">{notice.event_description}</p>
          )}
        </div>

        {/* Photo Attachments */}
        {documents.length > 0 && (
          <div className="bg-white rounded-md border border-[#D8D2C4] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#111827] mb-3">Attachments</h3>
            {/* Photos */}
            {documents.filter(d => d.file_type.startsWith('image/')).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                {documents.filter(d => d.file_type.startsWith('image/')).map(d => {
                  const url = docUrls[d.id];
                  if (!url) return null;
                  return (
                    <a key={d.id} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={d.file_name} className="w-full h-36 object-cover rounded-lg border border-[#D8D2C4] hover:opacity-90 transition-opacity" />
                    </a>
                  );
                })}
              </div>
            )}
            {/* Other files */}
            {documents.filter(d => !d.file_type.startsWith('image/')).length > 0 && (
              <div className="space-y-1">
                {documents.filter(d => !d.file_type.startsWith('image/')).map(d => {
                  const url = docUrls[d.id];
                  return (
                    <a key={d.id} href={url || '#'} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2.5 bg-[#F5F2EA] rounded-md hover:bg-[#E7E0D2] transition-colors">
                      <div>
                        <div className="text-[14px] font-medium text-[#111827] truncate">{d.file_name}</div>
                        <div className="text-[12px] text-[#64748B]">{(d.file_size / 1024).toFixed(0)} KB</div>
                      </div>
                      <span className="text-[12px] text-[#17212B] font-medium flex-shrink-0 ml-3">Download ↓</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Implications Card — office/admin only */}
        {!isField && <div className="bg-white rounded-md border border-[#D8D2C4] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#111827] mb-4">Impact</h3>
          <div className={`grid gap-4 md:gap-6 ${editing ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className={editing || (notice.cost_flag && (notice.cost_items as any[])?.length > 0) ? 'col-span-2' : ''}>
              <div className={labelClass}>Cost Impact</div>
              {editing ? (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editCostFlag}
                      onChange={e => setEditCostFlag(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#E76F00]"
                    />
                    <span className="text-[14px] text-[#111827]">Cost impact</span>
                  </label>
                  {editCostFlag && (
                    <CostItemsTable items={editCostItems} onChange={setEditCostItems} />
                  )}
                </div>
              ) : (
                <div>
                  <div className={`text-[14px] font-medium mb-2 ${notice.cost_flag ? 'text-[#111827]' : 'text-[#334155]'}`}>
                    {notice.cost_flag ? 'Yes' : 'No'}
                  </div>
                  {notice.cost_flag && notice.cost_items && (notice.cost_items as any[]).length > 0 && (
                    <div className="border border-[#D8D2C4] rounded-md overflow-hidden">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-[#D8D2C4]">
                            <th className="text-left px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Description</th>
                            <th className="text-right px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider w-16">Qty</th>
                            <th className="text-left px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider w-16">Unit</th>
                            <th className="text-right px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider w-20">Rate</th>
                            <th className="text-right px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider w-24">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(notice.cost_items as any[]).map((item: any, i: number) => (
                            <tr key={i} className="border-b border-[#E7E0D2] last:border-b-0">
                              <td className="px-3 py-2 text-[#111827]">{item.description}</td>
                              <td className="px-3 py-2 text-right text-[#111827] tabular-nums">{item.qty}</td>
                              <td className="px-3 py-2 text-[#334155]">{item.unit}</td>
                              <td className="px-3 py-2 text-right text-[#111827] tabular-nums">${Number(item.rate).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium text-[#111827] tabular-nums">${Number(item.total).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50 border-t-2 border-[#D8D2C4]">
                            <td colSpan={4} className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total</td>
                            <td className="px-3 py-2 text-right font-bold text-[#111827] tabular-nums">
                              ${(notice.cost_items as any[]).reduce((s: number, i: any) => s + (Number(i.total) || 0), 0).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <div className={labelClass}>Time Impact</div>
              {editing ? (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editTimeFlag}
                      onChange={e => setEditTimeFlag(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#E76F00]"
                    />
                    <span className="text-[14px] text-[#111827]">Time impact</span>
                  </label>
                  {editTimeFlag && (
                    <div className="flex gap-2 mt-1">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={editTimeDays}
                        onChange={e => setEditTimeDays(e.target.value)}
                        placeholder="0"
                        className="w-24 px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md focus:ring-1 focus:ring-[#17212B] outline-none"
                      />
                      <select
                        value={editTimeUnit}
                        onChange={e => setEditTimeUnit(e.target.value as 'days' | 'hours')}
                        className="px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md focus:ring-1 focus:ring-[#17212B] outline-none bg-white"
                      >
                        <option value="days">days</option>
                        <option value="hours">hours</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className={`text-[14px] font-medium ${notice.time_flag ? 'text-[#111827]' : 'text-[#334155]'}`}>
                    {notice.time_flag ? 'Yes' : 'No'}
                  </div>
                  {notice.time_flag && notice.estimated_days != null && (
                    <div className="text-[14px] text-[#92722E] font-medium mt-0.5">
                      {notice.estimated_days} {notice.time_implication_unit === 'hours'
                        ? `hour${notice.estimated_days !== 1 ? 's' : ''}`
                        : `day${notice.estimated_days !== 1 ? 's' : ''}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>}

        {/* Linked Variation Request — office/admin only */}
        {!isField && <div className="bg-white rounded-md border border-[#D8D2C4] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#111827] mb-3">Linked Variation Request</h3>
          {linkedVariation ? (
            <Link
              href={`/variation/${linkedVariation.id}`}
              className="flex items-center justify-between p-3 bg-[#F5F2EA] rounded-md hover:bg-[#E7E0D2] transition-colors duration-[120ms]"
            >
              <div>
                <div className="text-[13px] font-mono font-bold text-[#17212B]">
                  {linkedVariation.variation_number ?? `VAR-${String(linkedVariation.sequence_number).padStart(3, '0')}`}
                </div>
                <div className="text-[14px] font-medium text-[#111827] mt-0.5">{linkedVariation.title}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <StatusBadge status={linkedVariation.status} />
                <span className="text-[12px] text-[#17212B] font-medium">View →</span>
              </div>
            </Link>
          ) : (
            <div className="space-y-3">
              <p className="text-[14px] text-[#334155]">No Variation Request has been raised from this notice yet.</p>
              {canCreateVR && (
                <button
                  onClick={handleConvertToVar}
                  disabled={converting}
                  className="w-full py-3 px-4 bg-[#E76F00] hover:bg-[#C75A00] disabled:opacity-50 text-white text-[14px] font-semibold rounded-md transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                >
                  {converting ? 'Creating...' : 'Convert to Variation Request →'}
                </button>
              )}
            </div>
          )}
        </div>}

        {/* Status History — office/admin only */}
        {!isField && revisions.length > 0 && (
          <div className="bg-white rounded-md border border-[#D8D2C4] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#111827] mb-3">Status History</h3>
            <div className="space-y-3 mb-4">
              {revisions.slice().sort((a, b) => new Date(a.sent_at ?? 0).getTime() - new Date(b.sent_at ?? 0).getTime()).map((rev) => (
                <div key={rev.id + '-timeline'} className="flex flex-wrap items-start gap-2 md:gap-4 text-[13px]">
                  <div className="text-[#64748B] tabular-nums text-[12px] pt-0.5 w-36 flex-shrink-0">
                    {rev.sent_at ? new Date(rev.sent_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-[#E76F00] px-2 py-0.5 rounded flex-shrink-0">
                      📧 Issued
                    </span>
                    <span className="text-[12px] text-[#111827] truncate">
                      {rev.revision_number === 0 ? 'Original' : `Rev ${rev.revision_number}`} → {rev.sent_to}
                      {rev.sent_cc ? ` (CC: ${rev.sent_cc})` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#E7E0D2] pt-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-2">Download sent versions</div>
            <div className="space-y-2">
              {revisions.map((rev) => (
                <div key={rev.id} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-md border border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white bg-[#17212B] px-2 py-0.5 rounded flex-shrink-0">
                      {rev.revision_number === 0 ? 'Original' : `Rev ${rev.revision_number}`}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] text-[#111827] truncate">
                        Sent to {rev.sent_to}
                      </div>
                      {rev.sent_cc && (
                        <div className="text-[11px] text-slate-400 truncate">CC: {rev.sent_cc}</div>
                      )}
                      <div className="text-[11px] text-slate-400">
                        {rev.sent_at ? new Date(rev.sent_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!project) return;
                      setGeneratingRevPdf(rev.revision_number);
                      try {
                        // Build a notice-like object from the snapshot
                        const snapNotice: VariationNotice = {
                          ...notice,
                          event_description: rev.event_description || notice.event_description,
                          event_date: rev.event_date || notice.event_date,
                          contract_clause: rev.contract_clause ?? notice.contract_clause,
                          issued_by_name: rev.issued_by_name ?? notice.issued_by_name,
                          issued_by_email: rev.issued_by_email ?? notice.issued_by_email,
                          time_flag: rev.time_flag ?? notice.time_flag,
                          estimated_days: rev.estimated_days ?? notice.estimated_days,
                          time_implication_unit: (rev.time_implication_unit as 'days' | 'hours') ?? notice.time_implication_unit,
                          cost_flag: rev.cost_flag ?? notice.cost_flag,
                          cost_items: rev.cost_items ?? notice.cost_items,
                          revision_number: rev.revision_number,
                          status: 'issued', // snapshot = always issued
                        };
                        const { html, css } = getNoticeHtmlForPdf(snapNotice, project, company?.name || '', sender, noticeCompanyInfo, documents, docUrls);
                        const blob = await htmlToPdfBlob(html, css);
                        const { filename } = getNoticeEmailMeta(snapNotice, project);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(url), 10000);
                      } catch (err) {
                        console.error('Rev PDF failed:', err);
                      } finally {
                        setGeneratingRevPdf(null);
                      }
                    }}
                    disabled={generatingRevPdf === rev.revision_number}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-white transition-colors disabled:opacity-50 flex-shrink-0 ml-3"
                  >
                    <FileText size={13} />
                    {generatingRevPdf === rev.revision_number ? 'Building…' : 'PDF'}
                  </button>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}
      </div>

      {/* Awaiting Client Response Warning Modal */}
      {showClientWarning && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowClientWarning(null)}>
          <div className="bg-white rounded-t-xl sm:rounded-md border border-[#D8D2C4] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 className="text-[15px] font-semibold text-[#111827]">Awaiting client acknowledgement</h3>
            </div>
            <p className="text-[14px] text-[#334155] mb-1">
              This notice has been sent to <strong className="text-[#111827]">{notice.client_email}</strong> and hasn&apos;t been acknowledged yet.
            </p>
            <p className="text-[13px] text-[#64748B] mb-5">
              {showClientWarning === 'edit'
                ? 'Editing and reissuing will replace the current version. The client will need to be resent the updated notice.'
                : 'Deleting will permanently remove this notice. The client will not be notified.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowClientWarning(null)} className="px-3 py-1.5 text-[13px] font-medium text-[#334155] hover:text-[#111827] transition-colors">Cancel</button>
              <button
                onClick={() => {
                  if (showClientWarning === 'edit') { setShowClientWarning(null); startEditing(); }
                  else { setShowClientWarning(null); setShowDeleteConfirm(true); }
                }}
                className={`px-4 py-1.5 text-[13px] font-semibold text-white rounded-lg transition-colors ${showClientWarning === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {showClientWarning === 'edit' ? 'Edit anyway' : 'Delete anyway'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-t-xl sm:rounded-md border border-[#D8D2C4] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#111827] mb-2">Delete Notice</h3>
            <p className="text-[14px] text-[#334155] mb-1">
              Are you sure you want to delete <span className="font-medium text-[#111827]">{notice.notice_number}</span>?
            </p>
            {notice.status !== 'draft' ? (
              <p className="text-[13px] text-[#D99A00] bg-[#FEF3C7] border border-[#FDE68A] rounded-md px-3 py-2 mb-4">
                This notice has been <strong>{notice.status}</strong>. Deleting it will permanently remove it from your records — ensure the client has been notified separately if needed.
              </p>
            ) : (
              <p className="text-[13px] text-[#64748B] mb-5">This cannot be undone.</p>
            )}
            {deleteError && (
              <p className="text-[13px] text-[#B42318] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2 mb-4">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                disabled={deleting}
                className="px-3 py-1.5 text-[13px] font-medium text-[#334155] hover:text-[#111827] transition-colors duration-[120ms] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#B42318] rounded-md hover:bg-[#9E4D41] disabled:opacity-40 transition-colors duration-[120ms]"
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
