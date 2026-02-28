'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getVariationNumber, formatVariationNumber } from '@/lib/utils';
import { printProjectRegister } from '@/lib/print';
import { useRole } from '@/lib/role';
import type { Project, Variation, VariationNotice } from '@/lib/types';

type SortKey = 'sequence_number' | 'title' | 'status' | 'instruction_source' | 'estimated_value' | 'captured_at';

function ProjectDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledNoticeId = searchParams.get('noticeId');
  const autoOpenNewVar = searchParams.get('newVariation') === '1';
  const [project, setProject] = useState<Project | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('sequence_number');
  const [sortAsc, setSortAsc] = useState(true);
  const [notices, setNotices] = useState<VariationNotice[]>([]);
  const [showNewVariation, setShowNewVariation] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSource, setNewSource] = useState('verbal');
  const [newInstructedBy, setNewInstructedBy] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newNoticeId, setNewNoticeId] = useState(prefilledNoticeId || '');
  const [creatingVariation, setCreatingVariation] = useState(false);

  // Delete/Archive state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [togglingNoticeRequired, setTogglingNoticeRequired] = useState(false);
  const { isField, isAdmin, isOffice, companyId } = useRole();

  useEffect(() => {
    loadProject();
  }, [id]);

  useEffect(() => {
    if (autoOpenNewVar) {
      setShowNewVariation(true);
    }
  }, [autoOpenNewVar]);

  async function loadProject() {
    const supabase = createClient();
    const { data: proj } = await supabase.from('projects').select('*').eq('id', id).single();
    const { data: vars } = await supabase.from('variations').select('*').eq('project_id', id).order('sequence_number');
    const { data: noticesData } = await supabase
      .from('variation_notices')
      .select('*')
      .eq('project_id', id)
      .order('sequence_number');
    setProject(proj);
    setVariations(vars || []);
    setNotices(noticesData || []);
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

    let requestorName: string | null = null;
    let requestorEmail: string | null = null;
    if (user) {
      requestorEmail = user.email ?? null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      requestorName =
        profile?.full_name ??
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null;
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
      notice_id: newNoticeId || null,
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
      setNewNoticeId('');
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

  async function handleToggleNoticeRequired() {
    if (!project) return;
    setTogglingNoticeRequired(true);
    const supabase = createClient();
    const newValue = !project.notice_required;
    const { error } = await supabase.from('projects').update({ notice_required: newValue }).eq('id', project.id);
    if (!error) {
      setProject({ ...project, notice_required: newValue });
    }
    setTogglingNoticeRequired(false);
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

  const SortHeader = ({ label, field, align, className = '' }: { label: string; field: SortKey; align?: 'right'; className?: string }) => (
    <th
      className={`${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3 cursor-pointer hover:text-[#6B7280] select-none transition-colors duration-[120ms] ${className}`}
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
      <div className="p-4 md:p-8 space-y-5 md:space-y-6">
        <div>
          <Link href="/" className="text-[12px] text-[#1B365D] hover:text-[#24466F] font-medium transition-colors duration-[120ms]">← Back to Dashboard</Link>
          <div className="mt-3">
            <h2 className="text-xl font-semibold text-[#1C1C1E]">{project.name}</h2>
            <p className="text-[13px] text-[#6B7280] mt-1">{project.client} · {variations.length} variations{!isField && <> · <span className="tabular-nums">{formatCurrency(totalValue)}</span> total value</>}</p>
          </div>
          {/* Action buttons */}
          <div className="space-y-2 mt-3">
            {/* Primary row — full width on mobile, side by side */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewVariation(true)}
                className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.1)] whitespace-nowrap"
              >
                + New Variation
              </button>
              {!isField && (
                <Link
                  href={`/notice/new?projectId=${project.id}`}
                  className="flex-1 px-4 py-2.5 text-[13px] font-medium text-center text-[#1B365D] bg-white border border-[#1B365D] rounded-md hover:bg-[#F0F4FA] transition-colors duration-[120ms] whitespace-nowrap"
                >
                  + New Variation Notice
                </Link>
              )}
            </div>
            {/* Destructive row — right-aligned, text-only style */}
            {(!isField || isAdmin) && (
              <div className="flex justify-end gap-3">
                {!isField && (
                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    className="px-3 py-1.5 text-[12px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors duration-[120ms] whitespace-nowrap"
                  >
                    Archive Project
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 text-[12px] font-medium text-[#B25B4E] hover:text-[#9E4D41] transition-colors duration-[120ms] whitespace-nowrap"
                  >
                    Delete Project
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Project Settings — notice_required toggle (admin only) */}
        {isAdmin && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <div className="text-[14px] font-medium text-[#1C1C1E]">Require Variation Notice</div>
                <div className="text-[12px] text-[#9CA3AF] mt-0.5">Enable for Tier 1 contracts that require formal notice of variation events</div>
              </div>
              <button
                type="button"
                onClick={handleToggleNoticeRequired}
                disabled={togglingNoticeRequired}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-40 ${project.notice_required ? 'bg-[#1B365D]' : 'bg-[#D1D5DB]'}`}
                aria-checked={project.notice_required}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${project.notice_required ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {/* Variation Notices Section */}
        {notices.length > 0 && (
          <div>
            <h3 className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-[0.04em] mb-2">Variation Notices</h3>
            <div className="bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px]">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3">Notice No.</th>
                      <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3">Description</th>
                      <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3 hidden sm:table-cell">Event Date</th>
                      <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3">Status</th>
                      <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3 hidden md:table-cell">Linked VR</th>
                      <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {notices.map((n, i) => {
                      const linkedVar = variations.find(v => v.notice_id === n.id);
                      return (
                        <Link key={n.id} href={`/notice/${n.id}`} className="contents">
                          <tr className={`h-[44px] border-b border-[#F0F0EE] hover:bg-[#F5F3EF] cursor-pointer transition-colors duration-[120ms] ease-out ${i === notices.length - 1 ? 'border-b-0' : ''}`}>
                            <td className="px-4 md:px-5 py-2.5 text-[13px] font-mono font-medium text-[#1B365D] whitespace-nowrap">{n.notice_number}</td>
                            <td className="px-4 md:px-5 py-2.5 max-w-[180px] overflow-hidden"><div className="truncate text-[14px] text-[#1C1C1E]">{n.event_description}</div></td>
                            <td className="px-4 md:px-5 py-2.5 text-[13px] text-[#6B7280] hidden sm:table-cell whitespace-nowrap">{new Date(n.event_date + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="px-4 md:px-5 py-2.5"><StatusBadge status={n.status} /></td>
                            <td className="px-4 md:px-5 py-2.5 text-[13px] font-mono text-[#1B365D] hidden md:table-cell whitespace-nowrap">
                              {linkedVar ? (linkedVar.variation_number ?? `VAR-${String(linkedVar.sequence_number).padStart(3, '0')}`) : '—'}
                            </td>
                            <td className="px-4 md:px-5 py-2.5 text-right text-[12px] text-[#1B365D] font-medium whitespace-nowrap">View →</td>
                          </tr>
                        </Link>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {variations.length === 0 ? (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-12 text-center text-[#9CA3AF] text-sm">
            No variations captured for this project yet.
          </div>
        ) : (
          <div className="bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <SortHeader label="Var No." field="sequence_number" />
                    <SortHeader label="Title" field="title" />
                    <SortHeader label="Status" field="status" />
                    <SortHeader label="Source" field="instruction_source" className="hidden md:table-cell" />
                    {!isField && <SortHeader label="Value" field="estimated_value" align="right" className="hidden sm:table-cell" />}
                    <SortHeader label="Captured" field="captured_at" align="right" className="hidden sm:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((v, i) => (
                    <Link key={v.id} href={`/variation/${v.id}`} className="contents">
                      <tr className={`relative h-[44px] border-b border-[#F0F0EE] hover:bg-[#F5F3EF] cursor-pointer transition-colors duration-[120ms] ease-out ${i === sorted.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-4 md:px-5 py-2.5 text-[13px] font-mono font-medium text-[#1B365D] tabular-nums whitespace-nowrap">{getVariationNumber(v)}</td>
                        <td className="px-4 md:px-5 py-2.5 max-w-[200px] overflow-hidden"><div className="truncate text-[14px] font-medium text-[#1C1C1E]">{v.title}</div></td>
                        <td className="px-4 md:px-5 py-2.5"><StatusBadge status={v.status} /></td>
                        <td className="px-4 md:px-5 py-2.5 text-[13px] text-[#6B7280] capitalize hidden md:table-cell whitespace-nowrap">{v.instruction_source?.replace(/_/g, ' ')}</td>
                        {!isField && <td className="px-4 md:px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E] text-right tabular-nums hidden sm:table-cell whitespace-nowrap">{formatCurrency(v.estimated_value)}</td>}
                        <td className="px-4 md:px-5 py-2.5 text-[13px] text-[#6B7280] text-right hidden sm:table-cell whitespace-nowrap">{formatDate(v.captured_at)}</td>
                      </tr>
                    </Link>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* New Variation Modal */}
        {showNewVariation && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowNewVariation(false)}>
            <div className="bg-white rounded-t-xl sm:rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">New Variation</h3>
              {project.notice_required && (
                <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-[#FDF8ED] border border-[#C8943E]/30 rounded-md text-[13px]">
                  <span className="text-[#92722E] mt-0.5">⚠</span>
                  <div>
                    <span className="text-[#92722E]">This project requires a Variation Notice. Consider issuing a notice before submitting this request.{' '}</span>
                    <Link href={`/notice/new?projectId=${project.id}`} className="text-[#1B365D] font-medium hover:text-[#24466F] transition-colors" onClick={() => setShowNewVariation(false)}>
                      Create Notice First →
                    </Link>
                  </div>
                </div>
              )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                {(() => {
                  const unlinkableNotices = notices.filter(n => n.status === 'issued' && !variations.some(v => v.notice_id === n.id));
                  if (unlinkableNotices.length === 0) return null;
                  return (
                    <div>
                      <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Link to Variation Notice (optional)</label>
                      <select
                        value={newNoticeId}
                        onChange={e => setNewNoticeId(e.target.value)}
                        className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none bg-white"
                      >
                        <option value="">None</option>
                        {unlinkableNotices.map(n => (
                          <option key={n.id} value={n.id}>{n.notice_number} — {n.event_description.substring(0, 50)}</option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-t-xl sm:rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowArchiveConfirm(false)}>
          <div className="bg-white rounded-t-xl sm:rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
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

export default function ProjectDetail() {
  return (
    <Suspense fallback={<AppShell><TopBar title="Project" /><div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Loading...</div></AppShell>}>
      <ProjectDetailContent />
    </Suspense>
  );
}
