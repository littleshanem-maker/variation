'use client';

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import CostItemsTable, { type CostItem } from '@/components/CostItemsTable';
import { formatCurrency, formatDate, getVariationNumber } from '@/lib/utils';
import { printVariation, getVariationHtmlForPdf } from '@/lib/print';
import { htmlToPdfBlob, shareOrDownloadPdf } from '@/lib/pdf';
import { getVariationEmailMeta } from '@/lib/email';
import { useRole } from '@/lib/role';
import type { Variation, Project, PhotoEvidence, VoiceNote, StatusChange, Document, VariationNotice } from '@/lib/types';
import { Lock, AlertTriangle, RotateCcw, CheckCircle, XCircle, Send, ArrowUpRight, FileText } from 'lucide-react';

const EDITABLE_STATUSES = ['draft', 'captured'];
const DELETABLE_STATUSES = ['draft', 'captured', 'submitted'];

export default function VariationDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoEdit = searchParams.get('edit') === '1';
  const autoEditFired = useRef(false);
  const [variation, setVariation] = useState<Variation | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<PhotoEvidence[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusChange[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [linkedNotice, setLinkedNotice] = useState<VariationNotice | null>(null);
  const [loading, setLoading] = useState(true);

  const { isField, isAdmin, isOffice, company } = useRole();
  const [advancingStatus, setAdvancingStatus] = useState(false);
  const [sender, setSender] = useState<{ name: string; email: string }>({ name: '', email: '' });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [revisingMode, setRevisingMode] = useState(false);
  // Dispute reason flow
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [rejectionFiles, setRejectionFiles] = useState<File[]>([]);
  const [revisions, setRevisions] = useState<Variation[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editInstructedBy, setEditInstructedBy] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editCostItems, setEditCostItems] = useState<CostItem[]>([]);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReferenceDoc, setEditReferenceDoc] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);

  useEffect(() => { loadVariation(); }, [id]);

  function startEditing() {
    if (!variation) return;
    setEditTitle(variation.title);
    setEditDescription(variation.description || variation.ai_description || '');
    setEditSource(variation.instruction_source || 'verbal');
    setEditInstructedBy(variation.instructed_by || '');
    setEditValue((variation.estimated_value / 100).toFixed(2));
    setEditCostItems((variation as any).cost_items || []);
    setEditStatus(variation.status);
    setEditNotes(variation.notes || '');
    setEditReferenceDoc(variation.reference_doc || '');
    setEditDueDate(variation.response_due_date || '');
    setNewFiles([]);
    setEditing(true);
  }

  async function handleSave() {
    if (!variation || !editTitle.trim()) return;
    if (!editDueDate) { setSaveError('Please set a response due date.'); return; }
    setSaving(true);
    const supabase = createClient();
    const valueCents = Math.round(parseFloat(editValue || '0') * 100);

    // Revise mode: insert a new revision row instead of updating the current one
    if (revisingMode) {
      setSaveError(null);
      // Re-fetch revisions fresh in case the page was loaded before migration 014 ran
      const supabaseForRevisions = createClient();
      const { data: freshRevisions } = await supabaseForRevisions
        .from('variations')
        .select('revision_number')
        .eq('project_id', variation.project_id)
        .eq('sequence_number', variation.sequence_number);
      const revNums = (freshRevisions ?? []).map(r => (r as { revision_number?: number }).revision_number ?? 0);
      const nextRev = revNums.length > 0 ? Math.max(...revNums) + 1 : 1;
      const { data: newVar, error: insertError } = await supabase
        .from('variations')
        .insert({
          id: crypto.randomUUID(),
          project_id: variation.project_id,
          sequence_number: variation.sequence_number,
          revision_number: nextRev,
          parent_id: variation.id,
          title: editTitle.trim(),
          description: editDescription.trim(),
          instruction_source: editSource,
          instructed_by: editInstructedBy.trim() || null,
          reference_doc: editReferenceDoc.trim() || null,
          estimated_value: valueCents,
          cost_items: editCostItems,
          notes: editNotes.trim() || null,
          response_due_date: editDueDate || null,
          status: 'draft',
          captured_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError || !newVar) {
        setSaveError(`Save revision failed: ${insertError?.message ?? 'unknown error'}`);
        setSaving(false);
        return;
      }

      // Log revision creation in status history of the new variation
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('status_changes').insert({
        id: crypto.randomUUID(),
        variation_id: newVar.id,
        from_status: null,
        to_status: 'draft',
        changed_at: new Date().toISOString(),
        changed_by: `Revision ${nextRev} created by ${user?.email ?? 'Office'}`,
      });

      setSaving(false);
      setRevisingMode(false);
      setEditing(false);
      router.push(`/project/${variation.project_id}`);
      return;
    }

    const oldStatus = variation.status;

    const { error } = await supabase.from('variations').update({
      title: editTitle.trim(),
      description: editDescription.trim(),
      instruction_source: editSource,
      instructed_by: editInstructedBy.trim() || null,
      estimated_value: valueCents,
      cost_items: editCostItems,
      status: editStatus,
      notes: editNotes.trim() || null,
      reference_doc: editReferenceDoc.trim() || null,
      response_due_date: editDueDate || null,
    }).eq('id', variation.id);

    if (!error && editStatus !== oldStatus) {
      await supabase.from('status_changes').insert({
        id: crypto.randomUUID(),
        variation_id: variation.id,
        from_status: oldStatus,
        to_status: editStatus,
        changed_at: new Date().toISOString(),
        changed_by: 'Office',
      });
    }

    if (!error && newFiles.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        for (const file of newFiles) {
          const docId = crypto.randomUUID();
          const storagePath = `${user.id}/documents/${docId}/${file.name}`;
          const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, file);
          if (!uploadErr) {
            await supabase.from('documents').insert({
              id: docId,
              variation_id: variation.id,
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              storage_path: storagePath,
            });
          }
        }
      }
    }

    if (!error) {
      setEditing(false);
      setNewFiles([]);
      loadVariation();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!variation || !project) return;
    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();
    const { error } = await supabase.from('variations').delete().eq('id', variation.id);
    if (!error) {
      router.push(`/project/${project.id}`);
    } else {
      setDeleting(false);
      setDeleteError('Delete failed. You may not have permission, or the variation could not be removed.');
    }
  }

  function startRevising() {
    if (!variation) return;
    // Pre-fill edit fields with current variation values
    setEditTitle(variation.title);
    setEditDescription(variation.description || variation.ai_description || '');
    setEditSource(variation.instruction_source || 'verbal');
    setEditInstructedBy(variation.instructed_by || '');
    setEditValue((variation.estimated_value / 100).toFixed(2));
    setEditCostItems((variation as any).cost_items || []);
    setEditNotes(variation.notes || '');
    setEditReferenceDoc(variation.reference_doc || '');
    setEditDueDate(variation.response_due_date || '');
    setNewFiles([]);
    setRevisingMode(true);
    setEditing(true);
  }

  async function handleAdvanceStatus(newStatus: string) {
    if (!variation) return;
    setAdvancingStatus(true);
    const supabase = createClient();
    const oldStatus = variation.status;

    // When resubmitting after a withdraw, increment revision_number
    let updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'submitted') {
      const { data: prevSubmits } = await supabase
        .from('status_changes')
        .select('id')
        .eq('variation_id', variation.id)
        .eq('to_status', 'submitted')
        .limit(1);
      if (prevSubmits && prevSubmits.length > 0) {
        updatePayload.revision_number = (variation.revision_number ?? 0) + 1;
      }
    }

    const { error } = await supabase.from('variations').update(updatePayload).eq('id', variation.id);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const changedBy = user?.email ?? 'Office';
      await supabase.from('status_changes').insert({
        id: crypto.randomUUID(),
        variation_id: variation.id,
        from_status: oldStatus,
        to_status: newStatus,
        changed_at: new Date().toISOString(),
        changed_by: changedBy,
      });
      await loadVariation();
    }
    setAdvancingStatus(false);
  }

  async function loadVariation() {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setSender({
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        email: user.email || '',
      });
    }

    const { data: v } = await supabase.from('variations').select('*').eq('id', id).single();
    if (!v) { setLoading(false); return; }
    setVariation(v);

    const { data: proj } = await supabase.from('projects').select('*').eq('id', v.project_id).single();
    setProject(proj);

    const { data: revData } = await supabase
      .from('variations')
      .select('*')
      .eq('project_id', v.project_id)
      .eq('sequence_number', v.sequence_number)
      .order('revision_number', { ascending: true });
    setRevisions(revData ?? []);

    const { data: ph } = await supabase.from('photo_evidence').select('*').eq('variation_id', id).order('captured_at');
    setPhotos(ph || []);

    const { data: vn } = await supabase.from('voice_notes').select('*').eq('variation_id', id).order('captured_at');
    setVoiceNotes(vn || []);

    const { data: sc } = await supabase.from('status_changes').select('*').eq('variation_id', id).order('changed_at');
    setStatusHistory(sc || []);

    const { data: docs } = await supabase.from('documents').select('*').eq('variation_id', id).order('uploaded_at');
    setDocuments(docs || []);

    if (v.notice_id) {
      const { data: noticeData } = await supabase.from('variation_notices').select('*').eq('id', v.notice_id).single();
      setLinkedNotice(noticeData ?? null);
    } else {
      setLinkedNotice(null);
    }

    if (docs && docs.length > 0) {
      const urls: Record<string, string> = {};
      for (const doc of docs) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 3600);
        if (data?.signedUrl) urls[doc.id] = data.signedUrl;
      }
      setDocUrls(urls);
    }

    if (ph && ph.length > 0 && proj) {
      const urls: Record<string, string> = {};
      for (const photo of ph) {
        const { data } = await supabase.storage.from('evidence').createSignedUrl(
          `${proj.created_by}/photos/${photo.id}.jpg`, 3600
        );
        if (data?.signedUrl) urls[photo.id] = data.signedUrl;
      }
      setPhotoUrls(urls);
    }

    setLoading(false);

    // Auto-open edit mode when arriving from notice conversion (only fires once)
    if (autoEdit && !autoEditFired.current && v && EDITABLE_STATUSES.includes(v.status)) {
      autoEditFired.current = true;
      setEditTitle(v.title);
      setEditDescription(v.description || v.ai_description || '');
      setEditSource(v.instruction_source === 'written' ? 'other' : (v.instruction_source || 'verbal'));
      setEditInstructedBy(v.instructed_by || '');
      setEditValue(((v.estimated_value ?? 0) / 100).toFixed(2));
      setEditCostItems((v as any).cost_items || []);
      setEditStatus(v.status);
      setEditNotes(v.notes || '');
      setEditReferenceDoc(v.reference_doc || '');
      setEditDueDate(v.response_due_date || '');
      setEditing(true);
    }
  }

  const companyInfo = { logoUrl: company?.logo_url, abn: company?.abn, address: company?.address, phone: company?.phone, preferredStandard: company?.preferred_standard };

  function handlePrint() {
    if (variation && project) {
      printVariation(variation, project, photos, photoUrls, company?.name || '', sender, linkedNotice, revisions, companyInfo, documents, docUrls);
    }
  }

  async function handleSendEmail() {
    if (!variation || !project) return;
    setSendingEmail(true);
    try {
      const { html, css } = getVariationHtmlForPdf(variation, project, photos, photoUrls, company?.name || '', sender, linkedNotice, revisions, companyInfo, documents, docUrls);
      const blob = await htmlToPdfBlob(html, css);
      const { subject, body, filename } = getVariationEmailMeta(variation, project);
      await shareOrDownloadPdf(blob, filename, subject, body);
    } catch (err) {
      console.error('Email send failed:', err);
    } finally {
      setSendingEmail(false);
    }
  }

  if (loading) {
    return (
      <AppShell><TopBar title="Variation" />
        <div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Loading...</div>
      </AppShell>
    );
  }

  if (!variation || !project) {
    return (
      <AppShell><TopBar title="Variation" />
        <div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Variation not found</div>
      </AppShell>
    );
  }

  const canEdit = !isField && EDITABLE_STATUSES.includes(variation.status);
  const canDelete = !isField && DELETABLE_STATUSES.includes(variation.status);
  const canRevise = !isField && ['submitted', 'approved', 'disputed'].includes(variation.status);
  const isSubmitted = variation.status === 'submitted';
  const isDraft = EDITABLE_STATUSES.includes(variation.status);
  const isDisputed = variation.status === 'disputed';

  const inputClass = "w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow";
  const labelClass = "block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1";

  const STATUS_TRANSITIONS: Record<string, string[]> = {
    draft:     ['submitted'],
    captured:  ['submitted'],
    submitted: ['approved', 'rejected', 'disputed'],
    approved:  [],
    rejected:  [],
    disputed:  [],
    paid:      [],
  };
  const STATUS_ACTION_LABELS: Record<string, string> = {
    submitted: 'Submit for Approval',
    approved:  'Approve',
    rejected:  'Mark Rejected',
    disputed:  'Mark Disputed',
  };
  const STATUS_ACTION_STYLES: Record<string, string> = {
    submitted: 'text-[#92722E] border-[#C8943E] hover:bg-[#FDF8ED]',
    approved:  'text-[#3D6B5E] border-[#4A7C6F] hover:bg-[#F0F7F4]',
    rejected:  'text-[#5B3A7C] border-[#7C5BA0] hover:bg-[#F5F0FA]',
    disputed:  'text-[#9A4A3E] border-[#B25B4E] hover:bg-[#FDF2F0]',
  };
  const nextStatuses = STATUS_TRANSITIONS[variation.status] ?? [];

  return (
    <AppShell>
      <TopBar title="Variation Detail" />
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
            <div className="hidden md:block space-y-3">
              {/* Step 1 — Draft: Submit to Client */}
              {isDraft && !isField && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleAdvanceStatus('submitted')}
                    disabled={advancingStatus}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-40 transition-colors shadow-sm"
                  >
                    <Send size={14} />
                    {advancingStatus ? 'Saving…' : 'Submit to Client'}
                  </button>
                  <button
                    onClick={startEditing}
                    className="px-3 py-1.5 text-[13px] font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Edit
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1.5 text-[13px] font-medium text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}

              {/* Step 2 — Submitted to Client: Approved / Rejected */}
              {isSubmitted && !isField && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleAdvanceStatus('approved')}
                    disabled={advancingStatus}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-40 transition-colors shadow-sm"
                  >
                    <CheckCircle size={14} /> {advancingStatus ? '…' : 'Approved by Client'}
                  </button>
                  <button
                    onClick={() => { setShowDisputeDialog(true); setDisputeReason(''); }}
                    disabled={advancingStatus}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                  >
                    <XCircle size={14} /> Rejected by Client
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail}
                    className="px-3 py-1.5 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {sendingEmail ? 'Preparing…' : '📎 Export & Share PDF'}
                  </button>
                  {/* Withdraw & Edit — escape hatch, subtle */}
                  <button
                    onClick={() => handleAdvanceStatus('draft')}
                    disabled={advancingStatus}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    title="Withdraw and return to draft for editing"
                  >
                    <RotateCcw size={12} /> Withdraw
                  </button>
                </div>
              )}

              {/* Step 3 — Rejected: Revise */}
              {isDisputed && !isField && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={startRevising}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                  >
                    <ArrowUpRight size={14} /> Revise
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail}
                    className="px-3 py-1.5 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {sendingEmail ? 'Preparing…' : '📎 Export & Share PDF'}
                  </button>
                </div>
              )}

              {/* Step 4 — Approved by Client: Mark as Paid */}
              {variation.status === 'approved' && !isField && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleAdvanceStatus('paid')}
                    disabled={advancingStatus}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-40 transition-colors shadow-sm"
                  >
                    <CheckCircle size={14} /> {advancingStatus ? '…' : 'Mark as Paid'}
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail}
                    className="px-3 py-1.5 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {sendingEmail ? 'Preparing…' : '📎 Export & Share PDF'}
                  </button>
                  {canRevise && (
                    <button
                      onClick={startRevising}
                      className="px-3 py-1.5 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      ↩ Revise
                    </button>
                  )}
                </div>
              )}

              {/* Paid / other terminal states */}
              {variation.status === 'paid' && !isField && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail}
                    className="px-3 py-1.5 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {sendingEmail ? 'Preparing…' : '📎 Export & Share PDF'}
                  </button>
                </div>
              )}
            </div>
          )}
          {editing && (
            <div className="flex gap-2">
              {saveError && (
                <p className="text-[13px] text-[#B25B4E] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2 self-center">{saveError}</p>
              )}
              <button
                onClick={() => { setEditing(false); setRevisingMode(false); setNewFiles([]); setSaveError(null); }}
                className="px-3 py-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editTitle.trim()}
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-lg hover:bg-[#24466F] disabled:opacity-40 transition-colors duration-[120ms]"
              >
                {saving ? 'Saving...' : revisingMode ? 'Save Revision' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        {/* Linked Variation Notice Banner */}
        {linkedNotice && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#FDF8ED] border border-[#C8943E]/30 rounded-md text-[13px]">
            <span className="font-mono font-bold text-[#1B365D]">{linkedNotice.notice_number}</span>
            <span className="text-[#6B7280]">—</span>
            {linkedNotice.issued_at
              ? <span className="text-[#92722E]">Issued {new Date(linkedNotice.issued_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              : <span className="text-[#92722E] capitalize">{linkedNotice.status}</span>
            }
            <Link href={`/notice/${linkedNotice.id}`} className="ml-auto text-[#1B365D] font-medium hover:text-[#24466F] transition-colors duration-[120ms]">
              View Notice →
            </Link>
          </div>
        )}

        {/* State banners */}
        {isSubmitted && !editing && (
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-700 font-medium">
            <Lock size={14} className="flex-shrink-0" />
            Submitted to client and locked. Use <span className="font-semibold">Withdraw</span> to pull back and edit.
          </div>
        )}
        {isDisputed && !editing && variation.notes?.startsWith('DISPUTE REASON:') && (
          <div className="flex items-start gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Rejected by client: </span>
              {variation.notes.replace('DISPUTE REASON: ', '')}
            </div>
          </div>
        )}

        {/* Progress Stepper */}
        {!editing && (() => {
          const isRejected = variation.status === 'disputed';
          const steps = [
            { key: 'draft',     label: 'Draft' },
            { key: 'submitted', label: 'Submitted' },
            { key: isRejected ? 'disputed' : 'approved', label: isRejected ? 'Rejected' : 'Approved' },
            { key: 'paid',      label: 'Paid' },
          ];
          const ORDER = ['draft', 'captured', 'submitted', 'approved', 'disputed', 'paid'];
          const currentIdx = ORDER.indexOf(variation.status);
          return (
            <div className="flex items-center gap-0 bg-white border border-[#E5E7EB] rounded-md px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {steps.map((step, i) => {
                const stepOrder = ORDER.indexOf(step.key);
                const isCurrent = variation.status === step.key || (step.key === 'draft' && variation.status === 'captured');
                const isDone = !isCurrent && currentIdx > stepOrder;
                const isNext = !isCurrent && !isDone;
                return (
                  <div key={step.key} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                        isCurrent
                          ? step.key === 'disputed' ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white'
                          : isDone
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className={`text-[10px] font-medium text-center leading-tight hidden sm:block ${
                        isCurrent
                          ? step.key === 'disputed' ? 'text-rose-600' : 'text-indigo-600'
                          : isDone ? 'text-emerald-600' : 'text-slate-400'
                      }`}>{step.label}</span>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`h-[2px] flex-1 mx-1 ${isDone ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Header Card */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {editing ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className={labelClass}>Title</label>
                  <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {!revisingMode && (
                  <div>
                    <label className={labelClass}>Status</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={inputClass + " bg-white"}>
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="disputed">Disputed</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className={labelClass}>Instruction Source</label>
                  <select value={editSource} onChange={e => setEditSource(e.target.value)} className={inputClass + " bg-white"}>
                    <option value="verbal">Verbal</option>
                    <option value="email">Email</option>
                    <option value="site_instruction">Site Instruction</option>
                    <option value="drawing_revision">Drawing Revision</option>
                    <option value="rfi">RFI</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Instructed By</label>
                  <input type="text" value={editInstructedBy} onChange={e => setEditInstructedBy(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Reference Document</label>
                <input type="text" value={editReferenceDoc} onChange={e => setEditReferenceDoc(e.target.value)} className={inputClass} placeholder="e.g. RFI-042, Rev C drawings" />
              </div>
              <div>
                <label className={labelClass}>Response Due Date <span className="text-red-500">*</span></label>
                <input type="date" required value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className={inputClass} />
                <p className="text-[11px] text-slate-500 mt-1">Date by which a response to this variation is required</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-[12px] font-mono font-bold text-[#1B365D] uppercase tracking-wider">{getVariationNumber(variation)}</div>
                    {(variation.revision_number ?? 0) > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-white bg-[#1B365D] px-1.5 py-0.5 rounded">
                        Rev {variation.revision_number}
                      </span>
                    )}
                  </div>
                  <h2 className="text-[22px] font-bold text-[#1C1C1E] truncate">{variation.title}</h2>
                  <p className="text-[13px] text-[#6B7280] mt-1 truncate">{project.name} · {project.client}</p>
                </div>
                <div className="sm:text-right flex sm:flex-col items-center sm:items-end gap-3 sm:gap-0 flex-shrink-0">
                  {!isField && <div className="text-[28px] font-bold text-[#1C1C1E] tabular-nums">{formatCurrency(variation.estimated_value)}</div>}
                  <div className="sm:mt-2"><StatusBadge status={variation.status} /></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-[#F0F0EE]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Instruction Source</div>
                  <div className="text-[15px] text-[#1C1C1E] mt-1 capitalize truncate">{variation.instruction_source?.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Instructed By</div>
                  <div className="text-[15px] text-[#1C1C1E] mt-1 truncate">{variation.instructed_by || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Captured</div>
                  <div className="text-[15px] text-[#1C1C1E] mt-1 whitespace-nowrap">{formatDate(variation.captured_at)}</div>
                </div>
                {(variation.requestor_name || variation.requestor_email) && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Submitted By</div>
                    <div className="text-[15px] text-[#1C1C1E] mt-1 truncate">{variation.requestor_name || '—'}</div>
                    {variation.requestor_email && (
                      <div className="text-[12px] text-[#6B7280] mt-0.5 break-all">{variation.requestor_email}</div>
                    )}
                  </div>
                )}
                {variation.reference_doc && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Reference Document</div>
                    <div className="text-[15px] text-[#1C1C1E] mt-1 truncate">{variation.reference_doc}</div>
                  </div>
                )}
                {variation.response_due_date && (() => {
                  const due = new Date(variation.response_due_date + 'T00:00:00');
                  const today = new Date(); today.setHours(0,0,0,0);
                  const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
                  const overdue = daysLeft < 0;
                  const dueSoon = daysLeft >= 0 && daysLeft <= 3;
                  return (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Response Due</div>
                      <div className={`text-[15px] font-semibold mt-1 ${overdue ? 'text-[#DC2626]' : dueSoon ? 'text-[#D97706]' : 'text-[#1C1C1E]'}`}>
                        {due.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className={`text-[12px] mt-0.5 ${overdue ? 'text-[#DC2626]' : dueSoon ? 'text-[#D97706]' : 'text-[#6B7280]'}`}>
                        {overdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d remaining`}
                      </div>
                    </div>
                  );
                })()}
                {variation.evidence_hash && (
                  <div className="sm:col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Evidence Hash</div>
                    <div className="text-[11px] text-[#9CA3AF] mt-1 font-mono break-all">{variation.evidence_hash}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Description */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-3">Description</h3>
          {editing ? (
            <textarea
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              className={inputClass + " resize-none"}
              rows={4}
              placeholder="Describe the scope change..."
            />
          ) : (
            <>
              <p className="text-[14px] text-[#1C1C1E] leading-relaxed whitespace-pre-wrap">
                {variation.ai_description || variation.description || '—'}
              </p>
              {variation.ai_description && variation.description && (
                <details className="mt-4">
                  <summary className="text-[12px] text-[#1B365D] cursor-pointer font-medium">View original</summary>
                  <p className="text-[13px] text-[#6B7280] mt-2 whitespace-pre-wrap">{variation.description}</p>
                </details>
              )}
            </>
          )}
        </div>



        {/* Cost Breakdown */}
        {(editing || (variation as any).cost_items?.length > 0) && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-3">Cost Breakdown</h3>
            {editing ? (
              <div className="bg-[#F9FAFB] rounded-lg border border-[#E5E7EB] p-3">
                <CostItemsTable
                  items={editCostItems}
                  onChange={setEditCostItems}
                  onTotalChange={cents => setEditValue((cents / 100).toFixed(2))}
                />
              </div>
            ) : (
              <div className="space-y-1">
                {((variation as any).cost_items || []).map((item: any) => (
                  <div key={item.id} className="flex justify-between text-[13px] py-1 border-b border-[#F0F0EE]">
                    <span className="text-[#1C1C1E]">{item.description} <span className="text-[#9CA3AF]">({item.qty} {item.unit} @ ${item.rate})</span></span>
                    <span className="font-medium tabular-nums">${item.total?.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[13px] pt-2 font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(variation.estimated_value)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Documents */}
        {(documents.length > 0 || editing) && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Documents {documents.length > 0 && `(${documents.length})`}</h3>
            <div className="space-y-2">
              {documents.map(doc => (
                <a
                  key={doc.id}
                  href={docUrls[doc.id] || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-[#F8F8F6] rounded-md hover:bg-[#F0F0EE] transition-colors duration-[120ms]"
                >
                  <div className="text-[#6B7280]">📄</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-[#1C1C1E] truncate">{doc.file_name}</div>
                    <div className="text-[12px] text-[#9CA3AF]">{(doc.file_size / 1024).toFixed(0)} KB</div>
                  </div>
                  <span className="text-[12px] text-[#1B365D] font-medium flex-shrink-0">Download ↓</span>
                </a>
              ))}
            </div>
            {editing && (
              <div className="mt-3">
                <div
                  className="w-full px-3 py-4 border border-dashed border-[#D1D5DB] rounded-md text-center cursor-pointer hover:border-[#1B365D] hover:bg-[#F8FAFC] transition-colors duration-[120ms]"
                  onClick={() => document.getElementById('edit-file-input')?.click()}
                >
                  <input
                    id="edit-file-input"
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic"
                    onChange={e => {
                      if (e.target.files) {
                        setNewFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                      }
                    }}
                  />
                  <p className="text-[13px] text-[#6B7280]">Click to attach more files</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">PDF, Word, Excel, Images</p>
                </div>
                {newFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {newFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-[#F8F8F6] rounded text-[13px]">
                        <span className="text-[#1C1C1E] truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))}
                          className="text-[#9CA3AF] hover:text-[#B25B4E] ml-2 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Photo Evidence ({photos.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map(photo => (
                <div key={photo.id} className="aspect-square bg-[#F8F8F6] rounded-md overflow-hidden border border-[#E5E7EB]">
                  {photoUrls[photo.id] ? (
                    <img src={photoUrls[photo.id]} alt="Evidence" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#9CA3AF] text-[13px]">Loading...</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice Notes */}
        {voiceNotes.length > 0 && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Voice Notes ({voiceNotes.length})</h3>
            <div className="space-y-2">
              {voiceNotes.map(vn => (
                <div key={vn.id} className="flex items-start gap-3 p-3 bg-[#F8F8F6] rounded-md">
                  <div className="text-[#9CA3AF]">🎤</div>
                  <div className="flex-1">
                    <div className="text-[12px] text-[#9CA3AF]">{Math.round(vn.duration_seconds)}s · {formatDate(vn.captured_at)}</div>
                    {vn.transcription && (
                      <p className="text-[13px] text-[#6B7280] mt-1.5 italic leading-relaxed">&ldquo;{vn.transcription}&rdquo;</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status History */}
        {statusHistory.length > 0 && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-4 md:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Status History</h3>
            <div className="space-y-2.5">
              {statusHistory.map(sc => (
                <div key={sc.id} className="flex flex-wrap items-center gap-2 md:gap-4 text-[13px]">
                  <div className="text-[#9CA3AF] tabular-nums text-[12px]">{formatDate(sc.changed_at)}</div>
                  <div className="flex items-center gap-2">
                    {sc.from_status && <StatusBadge status={sc.from_status} />}
                    {sc.from_status && <span className="text-[#9CA3AF]">→</span>}
                    <StatusBadge status={sc.to_status} />
                  </div>
                  {sc.changed_by && <span className="text-[#6B7280]">by {sc.changed_by}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Revision History */}
        {revisions.length > 1 && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-3">Revision History</h3>
            <div className="space-y-1">
              {revisions.map(r => (
                <Link
                  key={r.id}
                  href={`/variation/${r.id}`}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-md text-[13px] transition-colors duration-[120ms] ${
                    r.id === variation.id
                      ? 'bg-[#EEF3FB] font-semibold text-[#1B365D] pointer-events-none'
                      : 'hover:bg-[#F8F8F6] text-[#1C1C1E]'
                  }`}
                >
                  <span className="font-mono">{getVariationNumber(r)}</span>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dispute Reason Dialog */}
      {showDisputeDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowDisputeDialog(false)}>
          <div className="bg-white rounded-t-xl sm:rounded-xl border border-[#E5E7EB] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <XCircle size={18} className="text-rose-500 flex-shrink-0" />
              <h3 className="text-[15px] font-semibold text-slate-900">Rejected by Client</h3>
            </div>
            <p className="text-[13px] text-slate-500 mb-4">Record the reason for rejection. This will be saved against the variation.</p>
            <textarea
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="e.g. This work falls within the original scope as per drawing M-201…"
              className="w-full px-3 py-2.5 text-[14px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-400 focus:border-rose-400 outline-none resize-none mb-3"
            />
            {/* Attachment upload */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => document.getElementById('rejection-file-input')?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-slate-600 border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors w-full justify-center"
              >
                📎 Attach client email or PDF
              </button>
              <input
                id="rejection-file-input"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.eml,.msg,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  setRejectionFiles(prev => [...prev, ...files]);
                  e.target.value = '';
                }}
              />
              {rejectionFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {rejectionFiles.map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-[12px] text-slate-600 bg-slate-50 rounded px-2 py-1">
                      <span className="truncate">📄 {f.name}</span>
                      <button
                        type="button"
                        onClick={() => setRejectionFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="ml-2 text-slate-400 hover:text-rose-500 flex-shrink-0"
                      >✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDisputeDialog(false); setDisputeReason(''); setRejectionFiles([]); }}
                className="px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!disputeReason.trim()) return;
                  await handleAdvanceStatus('disputed');
                  const supabase = createClient();
                  // Save rejection reason
                  await supabase.from('variations').update({
                    notes: `DISPUTE REASON: ${disputeReason.trim()}`
                  }).eq('id', variation!.id);
                  // Upload any attached files
                  if (rejectionFiles.length > 0) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      for (const file of rejectionFiles) {
                        const docId = crypto.randomUUID();
                        const storagePath = `${user.id}/documents/${docId}/${file.name}`;
                        const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, file);
                        if (!uploadErr) {
                          await supabase.from('documents').insert({
                            id: docId,
                            variation_id: variation!.id,
                            file_name: file.name,
                            file_type: file.type,
                            file_size: file.size,
                            storage_path: storagePath,
                          });
                        }
                      }
                    }
                  }
                  setShowDisputeDialog(false);
                  setDisputeReason('');
                  setRejectionFiles([]);
                  loadVariation();
                }}
                disabled={!disputeReason.trim() || advancingStatus}
                className="px-4 py-1.5 text-[13px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-40 transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Variation Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-t-xl sm:rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-2">Delete Variation</h3>
            <p className="text-[14px] text-[#6B7280] mb-1">
              Are you sure you want to delete <span className="font-medium text-[#1C1C1E]">Variation #{variation.sequence_number}: {variation.title}</span>?
            </p>
            <p className="text-[13px] text-[#9CA3AF] mb-5">This will permanently delete the variation and all associated photos, voice notes, and documents. This cannot be undone.</p>
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
                className="px-4 py-1.5 text-[13px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 disabled:opacity-40 transition-colors duration-[120ms]"
              >
                {deleting ? 'Deleting...' : 'Delete Variation'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile sticky action bar */}
      {!editing && !isField && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 bg-white border-t border-slate-200 px-4 py-3 flex flex-col gap-2 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
          {isDraft && (
            <>
              <button
                onClick={() => handleAdvanceStatus('submitted')}
                disabled={advancingStatus}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-[14px] font-semibold text-white bg-indigo-600 rounded-xl disabled:opacity-40 transition-colors active:bg-indigo-700"
              >
                <Send size={15} />
                {advancingStatus ? 'Saving…' : 'Submit to Client'}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={startEditing} className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  Edit
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl disabled:opacity-50 transition-colors"
                >
                  <FileText size={14} /> {sendingEmail ? '…' : 'PDF / Send'}
                </button>
              </div>
            </>
          )}
          {isSubmitted && (
            <>
              <button
                onClick={() => handleAdvanceStatus('approved')}
                disabled={advancingStatus}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-[14px] font-semibold text-white bg-emerald-600 rounded-xl disabled:opacity-40 transition-colors active:bg-emerald-700"
              >
                <CheckCircle size={15} /> {advancingStatus ? '…' : 'Approved by Client'}
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { setShowDisputeDialog(true); setDisputeReason(''); }}
                  disabled={advancingStatus}
                  className="flex items-center justify-center gap-1 px-2 py-2.5 text-[13px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl"
                >
                  Rejected
                </button>
                <button onClick={() => handleAdvanceStatus('draft')} disabled={advancingStatus} className="flex items-center justify-center gap-1 px-2 py-2.5 text-[12px] font-medium text-slate-400 border border-slate-200 rounded-xl">
                  Withdraw
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="flex items-center justify-center gap-1 px-2 py-2.5 text-[13px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl disabled:opacity-50"
                >
                  <FileText size={14} /> {sendingEmail ? '…' : 'PDF'}
                </button>
              </div>
            </>
          )}
          {isDisputed && (
            <>
              <button
                onClick={startRevising}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-[14px] font-semibold text-white bg-indigo-600 rounded-xl transition-colors active:bg-indigo-700"
              >
                <ArrowUpRight size={15} /> Revise
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl disabled:opacity-50"
              >
                <FileText size={14} /> {sendingEmail ? 'Building…' : 'PDF / Send'}
              </button>
            </>
          )}
          {variation.status === 'approved' && (
            <>
              <button
                onClick={() => handleAdvanceStatus('paid')}
                disabled={advancingStatus}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-[14px] font-semibold text-white bg-emerald-700 rounded-xl disabled:opacity-40 transition-colors active:bg-emerald-800"
              >
                <CheckCircle size={15} /> {advancingStatus ? '…' : 'Mark as Paid'}
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl disabled:opacity-50"
              >
                <FileText size={14} /> {sendingEmail ? 'Building…' : 'PDF / Send'}
              </button>
            </>
          )}
          {!isDraft && !isSubmitted && !isDisputed && variation.status !== 'approved' && (
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-[14px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl disabled:opacity-50"
            >
              <FileText size={14} /> {sendingEmail ? 'Building…' : 'PDF / Send'}
            </button>
          )}
        </div>
      )}
    </AppShell>
  );
}
