'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getVariationNumber } from '@/lib/utils';
import { printProjectRegister } from '@/lib/print';
import { useRole } from '@/lib/role';
import type { Project, Variation, VariationNotice } from '@/lib/types';
import { dedupeToLatestRevision } from '@/lib/dedupeVariations';

type SortKey = 'sequence_number' | 'title' | 'status' | 'instruction_source' | 'estimated_value' | 'captured_at';

function ProjectDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const _prefilledNoticeId = searchParams.get('noticeId'); // reserved for future use
  const [project, setProject] = useState<Project | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('sequence_number');
  const [sortAsc, setSortAsc] = useState(true);
  const [notices, setNotices] = useState<VariationNotice[]>([]);



  // Delete/Archive state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [togglingNoticeRequired, setTogglingNoticeRequired] = useState(false);
  const { isField, isAdmin, isOffice, companyId, company } = useRole();

  useEffect(() => {
    loadProject();
  }, [id]);



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
    setVariations(dedupeToLatestRevision(vars || []));
    setNotices(noticesData || []);
    setLoading(false);
  }

  function handlePrint() {
    if (project) {
      printProjectRegister(project, variations, company?.name);
    }
  }

  async function handleDeleteProject() {
    if (!project) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (!error) {
      router.push('/dashboard');
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
      router.push('/dashboard');
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
      className={`${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-medium text-[#4B5563] uppercase tracking-[0.02em] px-4 md:px-5 py-3 cursor-pointer hover:text-[#334155] select-none transition-colors duration-[120ms] ${className}`}
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  if (loading) {
    return (
      <AppShell><TopBar title="Project" />
        <div className="flex items-center justify-center h-96 text-[#4B5563] text-sm">Loading...</div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell><TopBar title="Project" />
        <div className="flex items-center justify-center h-96 text-[#4B5563] text-sm">Project not found</div>
      </AppShell>
    );
  }

  const totalValue = variations.reduce((sum, v) => sum + v.estimated_value, 0);

  return (
    <AppShell>
      <TopBar title={project.name} />
      <div className="p-4 md:p-8 space-y-5 md:space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 w-full bg-[#FFFCF5] border border-[#D8D2C4] rounded-md px-4 py-3 text-[14px] font-medium text-[#17212B] hover:bg-[#F5F2EA] active:bg-[#F5F2EA] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Dashboard
          </Link>
          <div className="mt-3">
            <h2 className="text-xl font-medium text-[#111827]">{project.name}</h2>
            <p className="text-[13px] text-[#334155] mt-1">{project.client} · {variations.length} variations{!isField && <> · <span className="tabular-nums">{formatCurrency(totalValue)}</span> total value</>}</p>
          </div>
          {/* Action buttons */}
          <div className="space-y-2 mt-3">
            {/* Destructive row — right-aligned, text-only style */}
            {(!isField || isAdmin) && (
              <div className="flex justify-end gap-3">
                {!isField && (
                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    className="px-3 py-1.5 text-[12px] font-medium text-[#334155] hover:text-[#111827] transition-colors duration-[120ms] whitespace-nowrap"
                  >
                    Archive Project
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 text-[12px] font-medium text-[#B42318] hover:text-[#7A1810] transition-colors duration-[120ms] whitespace-nowrap"
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
          <div className="bg-[#FFFCF5] rounded-md border border-[#D8D2C4] p-4 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <div className="text-[14px] font-medium text-[#111827]">Require Variation Notice</div>
                <div className="text-[12px] text-[#4B5563] mt-0.5">Enable for Tier 1 contracts that require formal notice of variation events</div>
              </div>
              <button
                type="button"
                onClick={handleToggleNoticeRequired}
                disabled={togglingNoticeRequired}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-40 ${project.notice_required ? 'bg-[#17212B]' : 'bg-[#D8D2C4]'}`}
                aria-checked={project.notice_required}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#FFFCF5] transition-transform duration-200 ${project.notice_required ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {/* Variation Notices Section */}
        {notices.length > 0 && (
          <div>
            <h3 className="text-[13px] font-medium text-[#334155] uppercase tracking-[0.04em] mb-2">Variation Notices</h3>

            {/* Mobile cards — md:hidden */}
            <div className="md:hidden divide-y divide-[#D8D2C4] bg-[#FFFCF5] rounded-md border border-[#D8D2C4] shadow-[0_1px_2px_rgba(17,24,39,0.04)] overflow-hidden">
              {notices.map(n => {
                const linkedVar = variations.find(v => v.notice_id === n.id);
                const varLabel = linkedVar
                  ? (linkedVar.variation_number ?? `VAR-${String(linkedVar.sequence_number).padStart(3, '0')}`)
                  : null;
                return (
                  <Link key={n.id} href={`/notice/${n.id}`}>
                    <div className="px-4 py-3 hover:bg-[#F5F2EA] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] mono font-medium text-[#111827]">{n.notice_number}</div>
                          <div className="text-[14px] font-medium text-[#111827] mt-0.5 truncate">{n.event_description}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[12px] text-[#4B5563]">
                              {new Date(n.event_date + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            {varLabel && (
                              <span className="text-[11px] mono font-medium text-[#2E7D32] bg-[#E5F0E6] px-1.5 py-0.5 rounded">
                                → {varLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={n.status} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop table — hidden md:block */}
            <div className="hidden md:block bg-[#FFFCF5] rounded-md border border-[#D8D2C4] shadow-[0_1px_2px_rgba(17,24,39,0.04)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px]" style={{tableLayout: 'fixed'}}>
                  <colgroup>
                    <col style={{width: '110px'}} />  {/* Notice No. */}
                    <col />                            {/* Description — flex */}
                    <col style={{width: '110px'}} />  {/* Status */}
                    <col style={{width: '100px'}} />  {/* Event Date */}
                    <col style={{width: '110px'}} />  {/* Linked VR */}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[#D8D2C4] bg-[#F5F2EA]/60">
                      <th className="text-left text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5">Notice No.</th>
                      <th className="text-left text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5">Description</th>
                      <th className="text-left text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5">Status</th>
                      <th className="text-left text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5">Event Date</th>
                      <th className="text-left text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5">Linked VR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notices.map((n, i) => {
                      const linkedVar = variations.find(v => v.notice_id === n.id);
                      return (
                        <Link key={n.id} href={`/notice/${n.id}`} className="contents">
                          <tr className={`border-b border-[#D8D2C4] hover:bg-[#F5F2EA] cursor-pointer transition-colors duration-[120ms] ease-out ${i === notices.length - 1 ? 'border-b-0' : ''}`}>
                            <td className="px-3 md:px-4 py-3 text-[13px] font-medium text-[#111827] whitespace-nowrap tabular-nums">{n.notice_number}</td>
                            <td className="px-3 md:px-4 py-3 overflow-hidden"><div className="truncate text-[14px] font-medium text-[#111827]">{n.event_description}</div></td>
                            <td className="px-3 md:px-4 py-3"><StatusBadge status={n.status} /></td>
                            <td className="px-3 md:px-4 py-3 text-[13px] text-[#111827] whitespace-nowrap">{new Date(n.event_date + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="px-3 md:px-4 py-3 text-[13px] text-[#111827] whitespace-nowrap">
                              {linkedVar ? (linkedVar.variation_number ?? `VAR-${String(linkedVar.sequence_number).padStart(3, '0')}`) : <span className="text-[#4B5563]">—</span>}
                            </td>
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

        <h3 className="text-[13px] font-medium text-[#334155] uppercase tracking-[0.04em] mb-2">Variation Requests</h3>

        {variations.length === 0 ? (
          <div className="bg-[#FFFCF5] rounded-md border border-[#D8D2C4] p-12 text-center text-[#4B5563] text-sm">
            No variations captured for this project yet.
          </div>
        ) : (
          <>
            {/* Mobile cards — md:hidden */}
            <div className="md:hidden rounded-md border border-[#D8D2C4] shadow-[0_1px_2px_rgba(17,24,39,0.04)] overflow-hidden">
              {sorted.map((v, i) => (
                <Link key={v.id} href={`/variation/${v.id}`}>
                  <div className={`px-4 py-3 border-b border-[#D8D2C4] last:border-b-0 hover:bg-[#F5F2EA] active:bg-[#F5F2EA] transition-colors ${i % 2 === 0 ? 'bg-[#FFFCF5]' : 'bg-[#F5F2EA]'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] mono font-medium text-[#17212B]">{getVariationNumber(v)}</div>
                        <div className="text-[14px] font-medium text-[#111827] mt-0.5 truncate">{v.title}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StatusBadge status={v.status} />
                        {!isField && (
                          <div className="text-[13px] font-medium text-[#111827] tabular-nums mt-1">{formatCurrency(v.estimated_value)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table — hidden md:block */}
            <div className="hidden md:block bg-[#FFFCF5] rounded-md border border-[#D8D2C4] shadow-[0_1px_2px_rgba(17,24,39,0.04)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="border-b border-[#D8D2C4]">
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
                        <tr className={`relative h-[44px] border-b border-[#D8D2C4] hover:bg-[#F5F2EA] cursor-pointer transition-colors duration-[120ms] ease-out ${i === sorted.length - 1 ? 'border-b-0' : ''}`}>
                          <td className="px-4 md:px-5 py-2.5 text-[13px] mono font-medium text-[#17212B] tabular-nums whitespace-nowrap">{getVariationNumber(v)}</td>
                          <td className="px-4 md:px-5 py-2.5 max-w-[200px] overflow-hidden"><div className="truncate text-[14px] font-medium text-[#111827]">{v.title}</div></td>
                          <td className="px-4 md:px-5 py-2.5"><StatusBadge status={v.status} /></td>
                          <td className="px-4 md:px-5 py-2.5 text-[13px] text-[#334155] capitalize hidden md:table-cell whitespace-nowrap">{v.instruction_source?.replace(/_/g, ' ')}</td>
                          {!isField && <td className="px-4 md:px-5 py-2.5 text-[14px] font-medium text-[#111827] text-right tabular-nums hidden sm:table-cell whitespace-nowrap">{formatCurrency(v.estimated_value)}</td>}
                          <td className="px-4 md:px-5 py-2.5 text-[13px] text-[#334155] text-right hidden sm:table-cell whitespace-nowrap">{formatDate(v.captured_at)}</td>
                        </tr>
                      </Link>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}


      </div>

      {/* Delete Project Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#111827]/20 px-0 sm:px-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-[#FFFCF5] rounded-t-xl sm:rounded-md border border-[#D8D2C4] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-medium text-[#111827] mb-2">Delete Project</h3>
            <p className="text-[14px] text-[#334155] mb-1">
              Are you sure you want to delete <span className="font-medium text-[#111827]">{project.name}</span>?
            </p>
            {variations.length > 0 ? (
              <p className="text-[13px] text-[#B42318] mb-5">
                This will also permanently delete all <span className="font-medium">{variations.length} variation{variations.length !== 1 ? 's' : ''}</span> and their associated data. This cannot be undone.
              </p>
            ) : (
              <p className="text-[13px] text-[#4B5563] mb-5">This cannot be undone.</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-3 py-1.5 text-[13px] font-medium text-[#334155] hover:text-[#111827] transition-colors duration-[120ms] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={deleting}
                className="px-4 py-1.5 text-[13px] font-medium text-[#FFFCF5] bg-[#B42318] rounded-md hover:bg-[#7A1810] disabled:opacity-40 transition-colors duration-[120ms]"
              >
                {deleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Project Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#111827]/20 px-0 sm:px-4" onClick={() => setShowArchiveConfirm(false)}>
          <div className="bg-[#FFFCF5] rounded-t-xl sm:rounded-md border border-[#D8D2C4] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-medium text-[#111827] mb-2">Archive Project</h3>
            <p className="text-[14px] text-[#334155] mb-1">
              Archive <span className="font-medium text-[#111827]">{project.name}</span>?
            </p>
            <p className="text-[13px] text-[#4B5563] mb-5">
              The project and its {variations.length} variation{variations.length !== 1 ? 's' : ''} will be hidden from the dashboard. You can unarchive at any time from the Archived Projects page.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                disabled={archiving}
                className="px-3 py-1.5 text-[13px] font-medium text-[#334155] hover:text-[#111827] transition-colors duration-[120ms] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveProject}
                disabled={archiving}
                className="px-4 py-1.5 text-[13px] font-medium text-[#FFFCF5] bg-[#334155] rounded-md hover:bg-[#334155] disabled:opacity-40 transition-colors duration-[120ms]"
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
    <Suspense fallback={<AppShell><TopBar title="Project" /><div className="flex items-center justify-center h-96 text-[#4B5563] text-sm">Loading...</div></AppShell>}>
      <ProjectDetailContent />
    </Suspense>
  );
}
