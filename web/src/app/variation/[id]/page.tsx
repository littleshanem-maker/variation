'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { printVariation } from '@/lib/print';
import type { Variation, Project, PhotoEvidence, VoiceNote, StatusChange, Document } from '@/lib/types';

const EDITABLE_STATUSES = ['captured', 'submitted'];
const DELETABLE_STATUSES = ['captured', 'submitted'];

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
  const [loading, setLoading] = useState(true);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit state
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

    // Log status change if changed
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

    // Upload new files
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
          `${proj.user_id}/photos/${photo.id}.jpg`, 3600
        );
        if (data?.signedUrl) urls[photo.id] = data.signedUrl;
      }
      setPhotoUrls(urls);
    }

    setLoading(false);
  }

  function handlePrint() {
    if (variation && project) {
      printVariation(variation, project, photos, photoUrls);
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

  const canEdit = EDITABLE_STATUSES.includes(variation.status);
  const canDelete = DELETABLE_STATUSES.includes(variation.status);

  const inputClass = "w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none";
  const labelClass = "block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1";

  return (
    <AppShell>
      <TopBar title={`Variation #${variation.sequence_number}`} onPrint={handlePrint} printLabel="Print Variation" />
      <div className="p-8 space-y-5 max-w-4xl">
        <div className="flex items-center justify-between">
          <Link href={`/project/${project.id}`} className="text-[12px] text-[#1B365D] hover:text-[#24466F] font-medium transition-colors duration-[120ms]">
            ← Back to {project.name}
          </Link>
          {!editing && (
            <div className="flex items-center gap-2">
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#B25B4E] border border-[#E5E7EB] rounded-md hover:bg-[#FDF2F0] hover:border-[#B25B4E] transition-colors duration-[120ms]"
                >
                  Delete Variation
                </button>
              )}
              {canEdit && (
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                >
                  Edit Variation
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

        {/* Header Card */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {editing ? (
            <>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className={labelClass}>Title</label>
                    <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputClass} />
                  </div>
                  <div className="w-48">
                    <label className={labelClass}>Estimated Value ($)</label>
                    <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className={inputClass} step="0.01" min="0" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Status</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={inputClass + " bg-white"}>
                      <option value="captured">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="approved">Approved</option>
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
            </>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#1C1C1E]">{variation.title}</h2>
                  <p className="text-[13px] text-[#6B7280] mt-1">{project.name} · {project.client}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-[#1C1C1E] tabular-nums">{formatCurrency(variation.estimated_value)}</div>
                  <div className="mt-2"><StatusBadge status={variation.status} /></div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6 mt-6 pt-5 border-t border-[#F0F0EE]">
                <div>
                  <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em]">Instruction Source</div>
                  <div className="text-[14px] text-[#1C1C1E] mt-1 capitalize">{variation.instruction_source?.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em]">Instructed By</div>
                  <div className="text-[14px] text-[#1C1C1E] mt-1">{variation.instructed_by || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em]">Captured</div>
                  <div className="text-[14px] text-[#1C1C1E] mt-1">{formatDate(variation.captured_at)}</div>
                </div>
                {variation.reference_doc && (
                  <div>
                    <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em]">Reference Document</div>
                    <div className="text-[14px] text-[#1C1C1E] mt-1">{variation.reference_doc}</div>
                  </div>
                )}
                {variation.evidence_hash && (
                  <div className="col-span-2">
                    <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em]">Evidence Hash</div>
                    <div className="text-[11px] text-[#9CA3AF] mt-1 font-mono break-all">{variation.evidence_hash}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Description */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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
        <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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
          <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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
                  <span className="text-[12px] text-[#1B365D] font-medium">Download ↓</span>
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
          <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Photo Evidence ({photos.length})</h3>
            <div className="grid grid-cols-3 gap-3">
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
          <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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
          <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Status History</h3>
            <div className="space-y-2.5">
              {statusHistory.map(sc => (
                <div key={sc.id} className="flex items-center gap-4 text-[13px]">
                  <div className="text-[#9CA3AF] w-28 tabular-nums">{formatDate(sc.changed_at)}</div>
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
    </AppShell>
  );
}
