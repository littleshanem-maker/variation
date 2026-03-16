'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { Send, FileText } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { printNotice, getNoticeHtmlForPdf } from '@/lib/print';
import { htmlToPdfBlob, shareOrDownloadPdf } from '@/lib/pdf';
import { getNoticeEmailMeta } from '@/lib/email';
import { useRole } from '@/lib/role';
import type { VariationNotice, Project, Variation, Document } from '@/lib/types';
import CostItemsTable, { type CostItem } from '@/components/CostItemsTable';

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
  const [sendingEmail, setSendingEmail] = useState(false);

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
      updated_at: new Date().toISOString(),
    }).eq('id', notice.id);
    if (error) {
      setSaveError('Save failed. Please try again.');
      setSaving(false);
    } else {
      // Upload new files
      if (newFiles.length > 0) {
        for (const file of newFiles) {
          const ext = file.name.split('.').pop() || 'bin';
          const { data: { user: upUser } } = await supabase.auth.getUser();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${upUser!.id}/documents/${docId}/${safeName}`;
          const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, file);
          if (!uploadErr) {
            await supabase.from('documents').insert({
              notice_id: notice.id,
              file_name: file.name,
              file_type: file.type || `application/${ext}`,
              file_size: file.size,
              storage_path: storagePath,
              uploaded_at: new Date().toISOString(),
            });
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

    // Navigate to the new variation in edit mode so user can fill in value + details
    router.push(`/variation/${varId}?edit=1`);
  }

  const noticeCompanyInfo = { logoUrl: company?.logo_url, abn: company?.abn, address: company?.address, phone: company?.phone, preferredStandard: company?.preferred_standard };

  function handlePrint() {
    if (notice && project) {
      printNotice(notice, project, company?.name || '', sender, noticeCompanyInfo, documents, docUrls);
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
      const blob = await htmlToPdfBlob(html, css);
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
  const canDelete = !isField && !linkedVariation;

  const labelClass = "block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1";

  return (
    <AppShell>
      <TopBar title="Variation Notice" />
      <div className="p-4 md:p-8 space-y-4 md:space-y-5 max-w-4xl">
        {/* Back + Actions */}
        <div className="space-y-3">
          <Link
            href={`/project/${project.id}`}
            className="hidden md:flex items-center gap-2 w-full bg-white border border-[#E5E7EB] rounded-md px-4 py-3 text-[14px] font-semibold text-[#1B365D] hover:bg-[#F0F4FA] active:bg-[#E8EFF8] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.04)] truncate"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="truncate">Back to {project.name}</span>
          </Link>
          {!editing && (
            <div className="flex flex-wrap items-center gap-2">
              {canIssue && (
                <button
                  onClick={handleIssue}
                  disabled={advancing}
                  className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors duration-[120ms] disabled:opacity-40 shadow-sm whitespace-nowrap"
                >
                  <Send size={14} />
                  {advancing ? '…' : 'Submitted to Client'}
                </button>
              )}
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="px-3 py-1.5 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {sendingEmail ? 'Preparing…' : '📎 Export & Share PDF'}
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={sendingEmail}
                className="hidden md:inline-flex px-3 py-1.5 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {sendingEmail ? '…' : '⬇ Download PDF'}
              </button>
              {!isField && (
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 text-[13px] font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
              )}
              {canAcknowledge && (
                <button
                  onClick={handleAcknowledge}
                  disabled={advancing}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#3D6B5E] border border-[#4A7C6F] rounded-lg hover:bg-[#F0F7F4] transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  {advancing ? '…' : 'Mark Acknowledged'}
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 text-[13px] font-medium text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 transition-colors whitespace-nowrap"
                >
                  Delete
                </button>
              )}
            </div>
          )}
          {editing && (
            <div className="space-y-3">
            {/* File attachments */}
            <div>
              <div
                className="w-full px-3 py-3 border border-dashed border-[#D1D5DB] rounded-md text-center cursor-pointer hover:border-[#1B365D] hover:bg-[#F8FAFC] transition-colors"
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
                <p className="text-[13px] text-[#6B7280]">📎 Attach photos or files</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">PDF, Word, Excel, Images</p>
              </div>
              {newFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {newFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-[#F8F8F6] rounded text-[13px]">
                      <span className="text-[#1C1C1E] truncate">{f.name}</span>
                      <button type="button" onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))} className="text-[#9CA3AF] hover:text-rose-500 ml-2">✕</button>
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
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-lg hover:bg-[#24466F] disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
            </div>
          )}
        </div>

        {/* Progress Stepper — hidden for field users */}
        {!editing && !isField && (() => {
          const isIssued = notice.status === 'issued' || notice.status === 'acknowledged';
          const steps = [
            { label: 'Draft', done: true, current: notice.status === 'draft' },
            { label: 'Submitted to Client', done: isIssued, current: isIssued },
          ];
          return (
            <div className="flex items-center gap-0 bg-white border border-[#E5E7EB] rounded-md px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {steps.map((step, i) => (
                <div key={step.label} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                      step.done && !step.current ? 'bg-emerald-500 text-white'
                      : step.current && i === 0 ? 'bg-indigo-600 text-white'
                      : step.current ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-400'
                    }`}>
                      {step.done && !step.current ? '✓' : step.current && i > 0 ? '✓' : i + 1}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight hidden sm:block ${
                      step.done ? 'text-emerald-600' : step.current ? 'text-indigo-600' : 'text-slate-400'
                    }`}>{step.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`h-[2px] flex-1 mx-1 ${isIssued ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Header Card */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="text-[12px] font-mono font-bold text-[#1B365D] uppercase tracking-wider mb-1">{notice.notice_number}{(notice.revision_number ?? 0) > 0 && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-white bg-[#1B365D] px-1.5 py-0.5 rounded">Rev {notice.revision_number}</span>}</div>
              <h2 className="text-xl font-semibold text-[#1C1C1E]">Variation Notice</h2>
              <p className="text-[13px] text-[#6B7280] mt-1">{project.name} · {project.client}</p>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-0">
              <StatusBadge status={notice.status} />
              {notice.issued_at && <div className="text-[12px] text-[#9CA3AF] sm:mt-2">Issued {formatDate(notice.issued_at)}</div>}
              {notice.acknowledged_at && <div className="text-[12px] text-[#9CA3AF] sm:mt-1">Acknowledged {formatDate(notice.acknowledged_at)}</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mt-5 pt-4 md:pt-5 border-t border-[#F0F0EE]">
            {editing ? (
              <>
                <div>
                  <label className={labelClass}>Event Date</label>
                  <input type="date" value={editEventDate} onChange={e => setEditEventDate(e.target.value)} className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none" />
                </div>
                <div>
                  <label className={labelClass}>Issued By Name</label>
                  <input type="text" value={editIssuedByName} onChange={e => setEditIssuedByName(e.target.value)} className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] outline-none" />
                </div>
                <div>
                  <label className={labelClass}>Issued By Email</label>
                  <input type="email" value={editIssuedByEmail} onChange={e => setEditIssuedByEmail(e.target.value)} className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] outline-none" />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelClass}>Contract Clause</label>
                  <input type="text" value={editContractClause} onChange={e => setEditContractClause(e.target.value)} className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] outline-none" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className={labelClass}>Event Date</div>
                  <div className="text-[14px] text-[#1C1C1E]">{new Date(notice.event_date + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                {notice.issued_by_name && (
                  <div>
                    <div className={labelClass}>Issued By</div>
                    <div className="text-[14px] text-[#1C1C1E]">{notice.issued_by_name}</div>
                    {notice.issued_by_email && <div className="text-[12px] text-[#6B7280] mt-0.5 break-all">{notice.issued_by_email}</div>}
                  </div>
                )}
                {notice.contract_clause && (
                  <div>
                    <div className={labelClass}>Contract Clause</div>
                    <div className="text-[14px] text-[#1C1C1E]">{notice.contract_clause}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Event Description */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-3">Description of Event</h3>
          {editing ? (
            <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={5} className="w-full px-3 py-2.5 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] outline-none resize-none" />
          ) : (
            <p className="text-[14px] text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">{notice.event_description}</p>
          )}
        </div>

        {/* Photo Attachments */}
        {documents.length > 0 && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-3">Attachments</h3>
            {/* Photos */}
            {documents.filter(d => d.file_type.startsWith('image/')).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                {documents.filter(d => d.file_type.startsWith('image/')).map(d => {
                  const url = docUrls[d.id];
                  if (!url) return null;
                  return (
                    <a key={d.id} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={d.file_name} className="w-full h-36 object-cover rounded-lg border border-[#E5E7EB] hover:opacity-90 transition-opacity" />
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
                      className="flex items-center justify-between px-3 py-2.5 bg-[#F8F8F6] rounded-md hover:bg-[#F0F0EE] transition-colors">
                      <div>
                        <div className="text-[14px] font-medium text-[#1C1C1E] truncate">{d.file_name}</div>
                        <div className="text-[12px] text-[#9CA3AF]">{(d.file_size / 1024).toFixed(0)} KB</div>
                      </div>
                      <span className="text-[12px] text-[#1B365D] font-medium flex-shrink-0 ml-3">Download ↓</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Implications Card — office/admin only */}
        {!isField && <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Impact</h3>
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
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                    />
                    <span className="text-[14px] text-[#1C1C1E]">Cost impact</span>
                  </label>
                  {editCostFlag && (
                    <CostItemsTable items={editCostItems} onChange={setEditCostItems} />
                  )}
                </div>
              ) : (
                <div>
                  <div className={`text-[14px] font-medium mb-2 ${notice.cost_flag ? 'text-[#1C1C1E]' : 'text-[#6B7280]'}`}>
                    {notice.cost_flag ? 'Yes' : 'No'}
                  </div>
                  {notice.cost_flag && notice.cost_items && (notice.cost_items as any[]).length > 0 && (
                    <div className="border border-[#E5E7EB] rounded-md overflow-hidden">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-[#E5E7EB]">
                            <th className="text-left px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Description</th>
                            <th className="text-right px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider w-16">Qty</th>
                            <th className="text-left px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider w-16">Unit</th>
                            <th className="text-right px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider w-20">Rate</th>
                            <th className="text-right px-3 py-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider w-24">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(notice.cost_items as any[]).map((item: any, i: number) => (
                            <tr key={i} className="border-b border-[#F0F0EE] last:border-b-0">
                              <td className="px-3 py-2 text-[#1C1C1E]">{item.description}</td>
                              <td className="px-3 py-2 text-right text-[#1C1C1E] tabular-nums">{item.qty}</td>
                              <td className="px-3 py-2 text-[#6B7280]">{item.unit}</td>
                              <td className="px-3 py-2 text-right text-[#1C1C1E] tabular-nums">${Number(item.rate).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium text-[#1C1C1E] tabular-nums">${Number(item.total).toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50 border-t-2 border-[#E5E7EB]">
                            <td colSpan={4} className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total</td>
                            <td className="px-3 py-2 text-right font-bold text-[#1C1C1E] tabular-nums">
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
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600"
                    />
                    <span className="text-[14px] text-[#1C1C1E]">Time impact</span>
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
                        className="w-24 px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] outline-none"
                      />
                      <select
                        value={editTimeUnit}
                        onChange={e => setEditTimeUnit(e.target.value as 'days' | 'hours')}
                        className="px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] outline-none bg-white"
                      >
                        <option value="days">days</option>
                        <option value="hours">hours</option>
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className={`text-[14px] font-medium ${notice.time_flag ? 'text-[#1C1C1E]' : 'text-[#6B7280]'}`}>
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
        {!isField && <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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
            <div className="space-y-3">
              <p className="text-[14px] text-[#6B7280]">No Variation Request has been raised from this notice yet.</p>
              {canCreateVR && (
                <button
                  onClick={handleConvertToVar}
                  disabled={converting}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[14px] font-semibold rounded-md transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                >
                  {converting ? 'Creating...' : 'Convert to Variation Request →'}
                </button>
              )}
            </div>
          )}
        </div>}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-t-xl sm:rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-2">Delete Notice</h3>
            <p className="text-[14px] text-[#6B7280] mb-1">
              Are you sure you want to delete <span className="font-medium text-[#1C1C1E]">{notice.notice_number}</span>?
            </p>
            {notice.status !== 'draft' ? (
              <p className="text-[13px] text-[#C8943E] bg-[#FEF3C7] border border-[#FDE68A] rounded-md px-3 py-2 mb-4">
                This notice has been <strong>{notice.status}</strong>. Deleting it will permanently remove it from your records — ensure the client has been notified separately if needed.
              </p>
            ) : (
              <p className="text-[13px] text-[#9CA3AF] mb-5">This cannot be undone.</p>
            )}
            {deleteError && (
              <p className="text-[13px] text-[#B25B4E] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2 mb-4">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
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
