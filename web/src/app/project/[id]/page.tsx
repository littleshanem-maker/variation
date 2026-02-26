'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getVariationNumber, formatVariationNumber } from '@/lib/utils';
import { printProjectRegister } from '@/lib/print';
import { useRole } from '@/lib/role';
import type { Project, Variation } from '@/lib/types';

type SortKey = 'sequence_number' | 'title' | 'status' | 'instruction_source' | 'estimated_value' | 'captured_at';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('sequence_number');
  const [sortAsc, setSortAsc] = useState(true);
  const [showNewVariation, setShowNewVariation] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSource, setNewSource] = useState('verbal');
  const [newInstructedBy, setNewInstructedBy] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [creatingVariation, setCreatingVariation] = useState(false);

  // Delete/Archive state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const { isField, isAdmin, isOffice, companyId } = useRole();

  useEffect(() => {
    loadProject();
  }, [id]);

  async function loadProject() {
    const supabase = createClient();
    const { data: proj } = await supabase.from('projects').select('*').eq('id', id).single();
    const { data: vars } = await supabase.from('variations').select('*').eq('project_id', id).order('sequence_number');
    setProject(proj);
    setVariations(vars || []);
    setLoading(false);
  }

  function handlePrint() {
    if (project) {
      printProjectRegister(project, variations);
    }
  }

  async function handleCreateVariation() {
    if (!newTitle.trim()) return;
    setCreatingVariation(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const nextSeq = variations.length > 0 ? Math.max(...variations.map(v => v.sequence_number)) + 1 : 1;
    const valueCents = Math.round(parseFloat(newValue || '0') * 100);
    const variationId = crypto.randomUUID();
    const variationNumber = formatVariationNumber(nextSeq);

    // Get requestor info from profile
    let requestorName: string | null = null;
    let requestorEmail: string | null = null;
    if (user) {
      requestorEmail = user.email ?? null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      requestorName = profile?.full_name ?? user.email ?? null;
    }

    const { error } = await supabase.from('variations').insert({
      id: variationId,
      project_id: id,
      sequence_number: nextSeq,
      variation_number: variationNumber,
      title: newTitle.trim(),
      description: newDescription.trim(),
      instruction_source: newSource,
      instructed_by: newInstructedBy.trim() || null,
      estimated_value: valueCents,
      status: 'draft',
      captured_at: new Date().toISOString(),
      requestor_name: requestorName,
      requestor_email: requestorEmail,
    });

    if (!error && newFiles.length > 0 && user) {
      for (const file of newFiles) {
        const docId = crypto.randomUUID();
        const storagePath = `${user.id}/documents/${docId}/${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, file);
        if (!uploadErr) {
          await supabase.from('documents').insert({
            id: docId,
            variation_id: variationId,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: storagePath,
          });
        }
      }
    }

    if (!error) {
      setNewTitle('');
      setNewDescription('');
      setNewSource('verbal');
      setNewInstructedBy('');
      setNewValue('');
      setNewFiles([]);
      setShowNewVariation(false);
      loadProject();
    }
    setCreatingVariation(false);
  }

  async function handleDeleteProject() {
    if (!project) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (!error) {
      router.push('/');
    } else {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleArchiveProject() {
    if (!project) return;
    setArchiving(true);
    const supabase = createClient();
    const { error } = await supabase.from('projects').update({ is_active: false }).eq('id', project.id);
    if (!error) {
      router.push('/');
    } else {
      setArchiving(false);
      setShowArchiveConfirm(false);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) { setSortAsc(!sortAsc); }
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...variations].sort((a, b) => {
    const aVal = a[sortKey]; const bVal = b[sortKey];
    if (aVal == null) return 1; if (bVal == null) return -1;
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const SortHeader = ({ label, field, align }: { label: string; field: SortKey; align?: 'right' }) => (
    <th
      className={`${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3 cursor-pointer hover:text-[#6B7280] select-none transition-colors duration-[120ms]`}
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  if (loading) {
    return (
      <AppShell><TopBar title="Project" />
        <div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Loading...</div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell><TopBar title="Project" />
        <div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Project not found</div>
      </AppShell>
    );
  }

  const totalValue = variations.reduce((sum, v) => sum + v.estimated_value, 0);

  return (
    <AppShell>
      <TopBar title={project.name} onPrint={isField ? undefined : handlePrint} printLabel="Print Register" />
      <div className="p-8 space-y-6">
        <div>
          <Link href="/" className="text-[12px] text-[#1B365D] hover:text-[#24466F] font-medium transition-colors duration-[120ms]">← Back to Dashboard</Link>
          <div className="flex items-center justify-between mt-3">
            <div>
              <h2 className="text-xl font-semibold text-[#1C1C1E]">{project.name}</h2>
              <p className="text-[13px] text-[#6B7280] mt-1">{project.client} · {variations.length} variations{!isField && <> · <span className="tabular-nums">{formatCurrency(totalValue)}</span> total value</>}</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#B25B4E] border border-[#E5E7EB] rounded-md hover:bg-[#FDF2F0] hover:border-[#B25B4E] transition-colors duration-[120ms]"
                >
                  Delete Project
                </button>
              )}
              {!isField && (
                <button
                  onClick={() => setShowArchiveConfirm(true)}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#6B7280] border border-[#E5E7EB] rounded-md hover:bg-[#F5F3EF] transition-colors duration-[120ms]"
                >
                  Archive Project
                </button>
              )}
              <button
                onClick={() => setShowNewVariation(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] transition-colors duration-[120ms] ease-out shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
              >
                + New Variation
              </button>
            </div>
          </div>
        </div>

        {variations.length === 0 ? (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-12 text-center text-[#9CA3AF] text-sm">
            No variations captured for this project yet.
          </div>
        ) : (
          <div className="bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <SortHeader label="Var No." field="sequence_number" />
                  <SortHeader label="Title" field="title" />
                  <SortHeader label="Status" field="status" />
                  <SortHeader label="Instruction Source" field="instruction_source" />
                  {!isField && <SortHeader label="Value" field="estimated_value" align="right" />}
                  <SortHeader label="Captured" field="captured_at" align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((v, i) => (
                  <Link key={v.id} href={`/variation/${v.id}`} className="contents">
                    <tr className={`relative h-[44px] border-b border-[#F0F0EE] hover:bg-[#F5F3EF] cursor-pointer transition-colors duration-[120ms] ease-out ${i === sorted.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-5 py-2.5 text-[13px] font-mono font-medium text-[#1B365D] tabular-nums">{getVariationNumber(v)}</td>
                      <td className="px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E]">{v.title}</td>
                      <td className="px-5 py-2.5"><StatusBadge status={v.status} /></td>
                      <td className="px-5 py-2.5 text-[13px] text-[#6B7280] capitalize">{v.instruction_source?.replace(/_/g, ' ')}</td>
                      {!isField && <td className="px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E] text-right tabular-nums">{formatCurrency(v.estimated_value)}</td>}
                      <td className="px-5 py-2.5 text-[13px] text-[#6B7280] text-right">{formatDate(v.captured_at)}</td>
                    </tr>
                  </Link>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* New Variation Modal */}
        {showNewVariation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowNewVariation(false)}>
            <div className="bg-white rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">New Variation</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                    placeholder="e.g. Additional fire dampers — Level 3"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Description</label>
                  <textarea
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none resize-none"
                    rows={3}
                    placeholder="Describe the scope change..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Instruction Source</label>
                    <select
                      value={newSource}
                      onChange={e => setNewSource(e.target.value)}
                      className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none bg-white"
                    >
                      <option value="verbal">Verbal</option>
                      <option value="email">Email</option>
                      <option value="site_instruction">Site Instruction</option>
                      <option value="drawing_revision">Drawing Revision</option>
                      <option value="rfi">RFI</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Instructed By</label>
                    <input
                      type="text"
                      value={newInstructedBy}
                      onChange={e => setNewInstructedBy(e.target.value)}
                      className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                      placeholder="e.g. John Smith"
                    />
                  </div>
                </div>
                {!isField && (
                  <div>
                    <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Estimated Value ($)</label>
                    <input
                      type="number"
                      value={newValue}
                      onChange={e => setNewValue(e.target.value)}
                      className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Attachments</label>
                  <div
                    className="w-full px-3 py-4 border border-dashed border-[#D1D5DB] rounded-md text-center cursor-pointer hover:border-[#1B365D] hover:bg-[#F8FAFC] transition-colors duration-[120ms]"
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    <input
                      id="file-input"
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
                    <p className="text-[13px] text-[#6B7280]">Click to attach files</p>
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
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setShowNewVariation(false)}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors duration-[120ms]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateVariation}
                  disabled={creatingVariation || !newTitle.trim()}
                  className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] disabled:opacity-40 transition-colors duration-[120ms]"
                >
                  {creatingVariation ? 'Creating...' : 'Create Variation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Project Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-2">Delete Project</h3>
            <p className="text-[14px] text-[#6B7280] mb-1">
              Are you sure you want to delete <span className="font-medium text-[#1C1C1E]">{project.name}</span>?
            </p>
            {variations.length > 0 ? (
              <p className="text-[13px] text-[#B25B4E] mb-5">
                This will also permanently delete all <span className="font-semibold">{variations.length} variation{variations.length !== 1 ? 's' : ''}</span> and their associated data. This cannot be undone.
              </p>
            ) : (
              <p className="text-[13px] text-[#9CA3AF] mb-5">This cannot be undone.</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-3 py-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors duration-[120ms] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={deleting}
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#B25B4E] rounded-md hover:bg-[#9E4D41] disabled:opacity-40 transition-colors duration-[120ms]"
              >
                {deleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Project Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowArchiveConfirm(false)}>
          <div className="bg-white rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-2">Archive Project</h3>
            <p className="text-[14px] text-[#6B7280] mb-1">
              Archive <span className="font-medium text-[#1C1C1E]">{project.name}</span>?
            </p>
            <p className="text-[13px] text-[#9CA3AF] mb-5">
              The project and its {variations.length} variation{variations.length !== 1 ? 's' : ''} will be hidden from the dashboard. You can unarchive at any time from the Archived Projects page.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                disabled={archiving}
                className="px-3 py-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors duration-[120ms] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveProject}
                disabled={archiving}
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#6B7280] rounded-md hover:bg-[#4B5563] disabled:opacity-40 transition-colors duration-[120ms]"
              >
                {archiving ? 'Archiving...' : 'Archive Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
