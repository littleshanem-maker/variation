'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getVariationNumber } from '@/lib/utils';
import { printVariation } from '@/lib/print';
import { useRole } from '@/lib/role';
import type { Variation, Project, PhotoEvidence, VoiceNote, StatusChange, Document, VariationNotice } from '@/lib/types';

const EDITABLE_STATUSES = ['draft', 'captured', 'submitted'];
const DELETABLE_STATUSES = ['draft', 'captured', 'submitted'];

export default function VariationDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editInstructedBy, setEditInstructedBy] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editReferenceDoc, setEditReferenceDoc] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);

  useEffect(() => { loadVariation(); }, [id]);

  function startEditing() {
    if (!variation) return;
    setEditTitle(variation.title);
    setEditDescription(variation.description || variation.ai_description || '');
    setEditSource(variation.instruction_source || 'verbal');
    setEditInstructedBy(variation.instructed_by || '');
    setEditValue((variation.estimated_value / 100).toFixed(2));
    setEditStatus(variation.status);
    setEditNotes(variation.notes || '');
    setEditReferenceDoc(variation.reference_doc || '');
    setNewFiles([]);
    setEditing(true);
  }

  async function handleSave() {
    if (!variation || !editTitle.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const valueCents = Math.round(parseFloat(editValue || '0') * 100);
    const oldStatus = variation.status;

    const { error } = await supabase.from('variations').update({
      title: editTitle.trim(),
      description: editDescription.trim(),
      instruction_source: editSource,
      instructed_by: editInstructedBy.trim() || null,
      estimated_value: valueCents,
      status: editStatus,
      notes: editNotes.trim() || null,
      reference_doc: editReferenceDoc.trim() || null,
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
    const supabase = createClient();
    const { error } = await supabase.from('variations').delete().eq('id', variation.id);
    if (!error) {
      router.push(`/project/${project.id}`);
    } else {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleAdvanceStatus(newStatus: string) {
    if (!variation) return;
    setAdvancingStatus(true);
    const supabase = createClient();
    const oldStatus = variation.status;
    const { error } = await supabase.from('variations').update({ status: newStatus }).eq('id', variation.id);
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
    const { data: v } = await supabase.from('variations').select('*').eq('id', id).single();
    if (!v) { setLoading(false); return; }
    setVariation(v);

    const { data: proj } = await supabase.from('projects').select('*').eq('id', v.project_id).single();
    setProject(proj);

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
  }

  function handlePrint() {
    if (variation && project) {
      printVariation(variation, project, photos, photoUrls, company?.name || '');
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

  const inputClass = "w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none";
  const labelClass = "block text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1";

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
    rejected:  'Reject',
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
      <TopBar title="Variation Shield" onPrint={isField ? undefined : handlePrint} printLabel="Print Variation" />
      <div className="p-4 md:p-8 space-y-4 md:space-y-5 max-w-4xl">
        {/* Back + Actions */}
        <div className="flex flex-wrap items-start gap-2">
          <Link href={`/project/${project.id}`} className="text-[12px] text-[#1B365D] hover:text-[#24466F] font-medium transition-colors duration-[120ms] mr-auto">
            ← Back to {project.name}
          </Link>
          {!editing && (
            <div className="flex flex-wrap items-center gap-2">
              {!isField && nextStatuses.map(nextStatus => (
                <button
                  key={nextStatus}
                  onClick={() => handleAdvanceStatus(nextStatus)}
                  disabled={advancingStatus}
                  className={`px-3 py-1.5 text-[13px] font-medium border rounded-md transition-colors duration-[120ms] disabled:opacity-40 ${STATUS_ACTION_STYLES[nextStatus] || 'text-[#6B7280] border-[#E5E7EB] hover:bg-[#F5F3EF]'}`}
                >
                  {advancingStatus ? '…' : (STATUS_ACTION_LABELS[nextStatus] ?? `→ ${nextStatus}`)}
                </button>
              ))}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#B25B4E] border border-[#E5E7EB] rounded-md hover:bg-[#FDF2F0] hover:border-[#B25B4E] transition-colors duration-[120ms]"
                >
                  Delete
                </button>
              )}
              {canEdit && (
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                >
                  Edit
                </button>
              )}
            </div>
          )}
          {editing && (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setNewFiles([]); }}
                className="px-3 py-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editTitle.trim()}
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] disabled:opacity-40 transition-colors duration-[120ms]"
              >
                {saving ? 'Saving...' : 'Save Changes'}
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

        {/* Header Card */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {editing ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className={labelClass}>Title</label>
                  <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputClass} />
                </div>
                <div className="sm:w-48">
                  <label className={labelClass}>Estimated Value ($)</label>
                  <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className={inputClass} step="0.01" min="0" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-mono font-bold text-[#1B365D] uppercase tracking-wider mb-1">{getVariationNumber(variation)}</div>
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
                      <div className="text-[12px] text-[#6B7280] mt-0.5 truncate">{variation.requestor_email}</div>
                    )}
                  </div>
                )}
                {variation.reference_doc && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Reference Document</div>
                    <div className="text-[15px] text-[#1C1C1E] mt-1 truncate">{variation.reference_doc}</div>
                  </div>
                )}
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

        {/* Notes */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-3">Notes</h3>
          {editing ? (
            <textarea
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              className={inputClass + " resize-none"}
              rows={3}
              placeholder="Internal notes..."
            />
          ) : (
            <p className="text-[14px] text-[#1C1C1E] whitespace-pre-wrap">{variation.notes || '—'}</p>
          )}
        </div>

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
      </div>

      {/* Delete Variation Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-t-xl sm:rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-2">Delete Variation</h3>
            <p className="text-[14px] text-[#6B7280] mb-1">
              Are you sure you want to delete <span className="font-medium text-[#1C1C1E]">Variation #{variation.sequence_number}: {variation.title}</span>?
            </p>
            <p className="text-[13px] text-[#9CA3AF] mb-5">This will permanently delete the variation and all associated photos, voice notes, and documents. This cannot be undone.</p>
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
                {deleting ? 'Deleting...' : 'Delete Variation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
