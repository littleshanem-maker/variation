'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import VariationSlideOver from '@/components/VariationSlideOver';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/DropdownMenu';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getStatusConfig, getVariationNumber } from '@/lib/utils';
import { getFilteredRegisterHtml, openRegisterForPrint } from '@/lib/print';
import { htmlToPdfBlob } from '@/lib/pdf';
import { useRole } from '@/lib/role';
import type { Variation, Project, VariationNotice } from '@/lib/types';
import { dedupeToLatestRevision } from '@/lib/dedupeVariations';
import * as XLSX from 'xlsx';
import { MoreHorizontal, Pencil, Send, Trash2 } from 'lucide-react';

type SortKey = 'sequence_number' | 'title' | 'project_name' | 'status' | 'estimated_value' | 'captured_at' | 'response_due_date';

function VariationsList() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  const initialProject = searchParams.get('project') || 'all';
  const showOnboardingSuccess = searchParams.get('onboarding') === 'success';

  const [variations, setVariations] = useState<(Variation & { project_name: string })[]>([]);
  const [rawProjects, setRawProjects] = useState<(Project & { variations: Variation[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('captured_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus);
  const [filterProject, setFilterProject] = useState<string>(initialProject);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [slideOverId, setSlideOverId] = useState<string | null>(null);
  const [notices, setNotices] = useState<(VariationNotice & { project_name: string })[]>([]);
  const [onboardingBannerDismissed, setOnboardingBannerDismissed] = useState(false);
  const { isField, company } = useRole();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setFilterStatus(searchParams.get('status') || 'all');
  }, [searchParams]);

  async function loadData() {
    const supabase = createClient();

    const { data: projects } = await supabase.from('projects').select('*').eq('is_active', true);
    const activeProjectIds = new Set(projects?.map(p => p.id) || []);
    const projectMap = new Map(projects?.map(p => [p.id, p.name]));

    const { data: vars } = await supabase
      .from('variations')
      .select('*')
      .order('captured_at', { ascending: false });

    // Fetch the latest sent revision number for each variation
    const { data: revisionSnapshots } = await supabase
      .from('variation_request_revisions')
      .select('variation_id, revision_number')
      .order('revision_number', { ascending: false });

    // Map: variation_id → latest revision_number (first row per variation due to DESC ordering)
    const latestRevisionMap = new Map<string, number>();
    if (revisionSnapshots) {
      for (const snap of revisionSnapshots) {
        if (!latestRevisionMap.has(snap.variation_id)) {
          latestRevisionMap.set(snap.variation_id, snap.revision_number);
        }
      }
    }

    if (vars) {
      const activeVars = vars.filter(v => activeProjectIds.has(v.project_id));
      const dedupedVars = dedupeToLatestRevision(activeVars);
      const enriched = dedupedVars.map(v => ({
        ...v,
        project_name: projectMap.get(v.project_id) || 'Unknown Project',
        _sentRevision: latestRevisionMap.get(v.id) ?? null,
      }));
      setVariations(enriched);

      const projectsWithVars = (projects || []).map(p => ({
        ...p,
        variations: dedupedVars.filter(v => v.project_id === p.id),
      }));
      setRawProjects(projectsWithVars);
    }
    const { data: noticesData } = await supabase
      .from('variation_notices')
      .select('*')
      .order('sequence_number', { ascending: true });
    if (noticesData) {
      const activeNotices = noticesData.filter((n: VariationNotice) => activeProjectIds.has(n.project_id));
      setNotices(activeNotices.map((n: VariationNotice) => ({
        ...n,
        project_name: projectMap.get(n.project_id) || 'Unknown Project'
      })));
    }

    setLoading(false);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) { setSortAsc(!sortAsc); }
    else { setSortKey(key); setSortAsc(true); }
  }

  const filtered = variations.filter(v => {
    const statusMatch = (() => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'at_risk') return v.status === 'disputed' || v.status === 'draft' || v.status === 'captured';
      if (filterStatus === 'draft') return v.status === 'draft' || v.status === 'captured';
      return v.status === filterStatus;
    })();
    const projectMatch = filterProject === 'all' || v.project_id === filterProject;
    return statusMatch && projectMatch;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey]; const bVal = b[sortKey];
    if (aVal == null) return 1; if (bVal == null) return -1;
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const totalValue = filtered.reduce((sum, v) => sum + v.estimated_value, 0);

  const SortHeader = ({ label, field, align, className = '' }: { label: string; field: SortKey; align?: 'right'; className?: string }) => (
    <th
      className={`${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5 cursor-pointer hover:text-[#334155] select-none transition-colors duration-[120ms] ${className}`}
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  function handlePrint() {
    const projectName = filterProject !== 'all'
      ? rawProjects.find(p => p.id === filterProject)?.name || 'Project'
      : 'All Projects';
    const statusLabel = filterStatus !== 'all'
      ? ` — ${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}`
      : '';
    const label = `${projectName}${statusLabel}`;
    const { html, css } = getFilteredRegisterHtml(sorted, label, company?.name);
    openRegisterForPrint(html, css, `Variation Register — ${label}`);
  }

  function handleExportExcel() {
    const rows = sorted.map(v => ({
      'Var No.': getVariationNumber(v),
      'Title': v.title,
      'Project': v.project_name,
      'Status': v.status.charAt(0).toUpperCase() + v.status.slice(1),
      'Revision': v.revision_number !== null ? `Rev ${v.revision_number}` : '',
      'Value (AUD)': (v.estimated_value || 0) / 100,
      'Captured': v.captured_at ? new Date(v.captured_at).toLocaleDateString('en-AU') : '',
      'Due Date': v.response_due_date ? (() => { const d = new Date(v.response_due_date + 'T00:00:00'); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`; })() : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 10 }, { wch: 40 }, { wch: 30 }, { wch: 12 },
      { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];

    // Format Value column as currency
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
      if (cell) cell.z = '"$"#,##0.00';
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Variation Register');

    const projectLabel = filterProject !== 'all'
      ? rawProjects.find(p => p.id === filterProject)?.name?.replace(/\s+/g, '-') || 'Project'
      : 'All-Projects';
    const statusLabel = filterStatus !== 'all' ? `-${filterStatus}` : '';
    const filename = `Variation-Register-${projectLabel}${statusLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    XLSX.writeFile(wb, filename);
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      const projectName = filterProject !== 'all'
        ? rawProjects.find(p => p.id === filterProject)?.name || 'Project'
        : 'All Projects';
      const statusLabel = filterStatus !== 'all'
        ? ` — ${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}`
        : '';
      const label = `${projectName}${statusLabel}`;

      const { html, css } = getFilteredRegisterHtml(sorted, label, company?.name);
      const blob = await htmlToPdfBlob(html, css);

      const projectSlug = projectName.replace(/\s+/g, '-');
      const filename = `Variation-Register-${projectSlug}${filterStatus !== 'all' ? `-${filterStatus}` : ''}-${new Date().toISOString().slice(0, 10)}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      console.error('PDF export failed:', err);
      alert('PDF generation failed. Try reducing the number of photos, or try again.');
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading) {
    return (
      <>
        <TopBar title="Variation Register" />
        <div className="flex items-center justify-center h-96 text-[#4B5563] text-sm">Loading...</div>
      </>
    );
  }

  const statuses = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'disputed', label: 'Disputed' },
    { value: 'at_risk', label: 'At Risk' },
  ];

  return (
    <>
      <TopBar title="Variation Register" />

      {/* Onboarding success banner */}
      {showOnboardingSuccess && !onboardingBannerDismissed && (
        <div
          className="mx-4 md:mx-8 mt-4 md:mt-6 px-4 py-3.5 rounded-lg flex items-center justify-between gap-3"
          style={{ backgroundColor: '#E5F0E6', border: '1px solid #E5F0E6', color: '#1F5223' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[16px]">✅</span>
            <div>
              <span className="text-[14px] font-medium">First variation captured. Welcome to Variation Shield.</span>
              <span className="text-[13px] ml-2">Every variation you capture from here is protected.</span>
            </div>
          </div>
          <button
            onClick={() => setOnboardingBannerDismissed(true)}
            className="flex-shrink-0 text-[18px] leading-none font-light"
            style={{ color: '#2E7D32' }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="p-4 md:p-8 space-y-5 md:space-y-6">
        <div>
          <h2 className="text-xl font-medium text-[#111827]">Variation Register</h2>
          <p className="text-[13px] text-[#334155] mt-1">
            {filtered.length} variations{isField ? '' : <> · <span className="tabular-nums">{formatCurrency(totalValue)}</span> total value</>}
          </p>
        </div>

        {/* Status filter tabs — row 1 */}
        <div className="flex flex-col gap-3">
          {/* Status tabs */}
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex bg-[#D8D2C4] p-1 rounded-md w-max">
              {statuses.map(s => (
                <button
                  key={s.value}
                  onClick={() => {
                    setFilterStatus(s.value);
                    const url = new URL(window.location.href);
                    url.searchParams.set('status', s.value);
                    window.history.pushState({}, '', url);
                  }}
                  className={`px-3 py-1.5 text-[13px] font-medium rounded-sm transition-all duration-[120ms] whitespace-nowrap ${
                    filterStatus === s.value
                      ? 'bg-[#FFFCF5] text-[#111827] shadow-sm'
                      : 'text-[#334155] hover:text-[#111827]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Project filter + exports */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Project filter dropdown */}
            <select
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
              className="px-3 py-1.5 text-[13px] border border-[#D8D2C4] rounded-md bg-[#FFFCF5] text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#17212B] shadow-[0_1px_2px_rgba(17,24,39,0.04)] w-full sm:w-auto"
            >
              <option value="all">All Projects</option>
              {rawProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Export to Excel */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#1F5223] bg-[#E5F0E6] border border-[#E5F0E6] rounded-md hover:bg-[#E5F0E6] transition-colors shadow-[0_1px_2px_rgba(17,24,39,0.04)] whitespace-nowrap"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Excel
            </button>

            {/* Export to PDF */}
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#7A1810] bg-[#FBE6E4] border border-[#FBE6E4] rounded-md hover:bg-[#FBE6E4] transition-colors shadow-[0_1px_2px_rgba(17,24,39,0.04)] whitespace-nowrap disabled:opacity-50 disabled:cursor-wait"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              {exportingPdf ? 'Generating…' : 'Export PDF'}
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="bg-[#FFFCF5] rounded-md border border-[#D8D2C4] p-12 text-center text-[#4B5563] text-sm">
            No variations match this filter.
          </div>
        ) : (
          <>
            {/* Mobile cards — md:hidden */}
            <div className="md:hidden divide-y divide-[#D8D2C4] bg-[#FFFCF5] rounded-md border border-[#D8D2C4] shadow-[0_1px_2px_rgba(17,24,39,0.04)] overflow-hidden">
              {sorted.map(v => (
                <button key={v.id} className="w-full text-left" onClick={() => setSlideOverId(v.id)}>
                  <div className="px-4 py-3 hover:bg-[#F5F2EA] transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] mono font-medium text-[#E76F00]">{getVariationNumber(v)}</div>
                        <div className="text-[14px] font-medium text-[#111827] mt-0.5 truncate">{v.title}</div>
                        <div className="text-[12px] text-[#4B5563] mt-0.5 truncate">{v.project_name}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StatusBadge status={v.status} />
                        {isField ? (
                          <span className="text-[13px] text-[#D8D2C4]">—</span>
                        ) : (
                          <div className="text-[13px] font-medium text-[#334155] mt-1">{formatCurrency(v.estimated_value)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop table — hidden md:block */}
            <div className="hidden md:block bg-[#FFFCF5] rounded-md border border-[#D8D2C4] shadow-[0_1px_2px_rgba(17,24,39,0.04)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]" style={{tableLayout: 'fixed'}}>
                  <colgroup>
                    <col style={{width: '130px'}} />  {/* Var No. */}
                    <col />                            {/* Title — flex */}
                    <col style={{width: '180px'}} />  {/* Project */}
                    <col style={{width: '110px'}} />  {/* Status */}
                    <col style={{width: '70px'}} />   {/* Revision */}
                    <col style={{width: '90px'}} />   {/* Captured */}
                    <col style={{width: '90px'}} />   {/* Due Date */}
                    <col style={{width: '100px'}} />  {/* Value */}
                    <col style={{width: '40px'}} />   {/* Actions */}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[#D8D2C4] bg-[#F5F2EA]/60">
                      <SortHeader label="Var No." field="sequence_number" />
                      <SortHeader label="Title" field="title" />
                      <SortHeader label="Project" field="project_name" className="hidden md:table-cell" />
                      <SortHeader label="Status" field="status" />
                      <th className="w-[70px] text-left text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3">Rev</th>
                      <SortHeader label="Captured" field="captured_at" align="right" className="hidden md:table-cell" />
                      <SortHeader label="Due Date" field="response_due_date" align="right" className="hidden lg:table-cell" />
                      <SortHeader label="Value" field="estimated_value" align="right" className="hidden sm:table-cell" />
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((v, i) => (
                      <tr
                        key={v.id}
                        onClick={() => setSlideOverId(v.id)}
                        className={`group relative border-b border-[#D8D2C4] hover:bg-[#F5F2EA] cursor-pointer transition-colors duration-[120ms] ease-out ${i === sorted.length - 1 ? 'border-b-0' : ''}`}
                      >
                        <td className="px-3 md:px-4 py-3 text-[13px] font-medium text-[#111827] tabular-nums whitespace-nowrap">
                          {getVariationNumber(v)}
                        </td>
                        <td className="px-3 md:px-4 py-3 max-w-[200px] overflow-hidden">
                          <div className="truncate text-[14px] font-medium text-[#111827]">{v.title}</div>
                        </td>
                        <td className="px-3 md:px-4 py-3 max-w-[160px] overflow-hidden hidden md:table-cell"><div className="truncate text-[13px] text-[#111827]">{v.project_name}</div></td>
                        <td className="px-3 md:px-4 py-3 w-[110px]"><StatusBadge status={v.status} /></td>
                        <td className="px-3 md:px-4 py-3 w-[70px]">
                          {v.revision_number !== null ? (
                            <span className="text-[13px] font-medium text-[#334155]">Rev {v.revision_number}</span>
                          ) : (
                            <span className="text-[13px] text-[#D8D2C4]">—</span>
                          )}
                        </td>
                        <td className="px-3 md:px-4 py-3 text-[13px] text-[#111827] text-right hidden md:table-cell whitespace-nowrap w-[90px]">{formatDate(v.captured_at)}</td>
                        <td className="px-3 md:px-4 py-3 text-right hidden lg:table-cell whitespace-nowrap">
                            {v.response_due_date ? (() => {
                              const due = new Date(v.response_due_date + 'T00:00:00');
                              const today = new Date(); today.setHours(0,0,0,0);
                              const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
                              const overdue = daysLeft < 0;
                              const dueSoon = daysLeft >= 0 && daysLeft <= 3;
                              return (
                                <span className={`text-[13px] font-medium ${overdue ? 'text-[#B42318]' : dueSoon ? 'text-[#8C6500]' : 'text-[#111827]'}`}>
                                  {`${String(due.getDate()).padStart(2,'0')}/${String(due.getMonth()+1).padStart(2,'0')}/${String(due.getFullYear()).slice(-2)}`}
                                </span>
                              );
                            })() : <span className="text-[13px] text-[#D8D2C4]">—</span>}
                          </td>
                        {isField ? (
                          <span className="text-[13px] text-[#D8D2C4]">—</span>
                        ) : (
                          <td className="px-3 md:px-4 py-3 text-[14px] font-medium text-[#111827] text-right tabular-nums hidden sm:table-cell whitespace-nowrap">{formatCurrency(v.estimated_value)}</td>
                        )}
                          {/* Ellipsis action menu */}
                          <td className="px-3 py-3 w-10" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="p-1 rounded-md text-[#4B5563] hover:text-[#334155] hover:bg-[#F5F2EA] opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <MoreHorizontal size={16} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => window.location.href = `/variation/${v.id}`}>
                                  <Pencil size={13} /> View / Edit
                                </DropdownMenuItem>
                                {['draft','captured'].includes(v.status) && (
                                  <DropdownMenuItem onSelect={() => window.location.href = `/variation/${v.id}`}>
                                    <Send size={13} /> Submit
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem destructive onSelect={() => {
                                  if (confirm(`Delete "${v.title}"? This cannot be undone.`)) {
                                    const supabase = createClient();
                                    supabase.from('variations').delete().eq('id', v.id).then(() => loadData());
                                  }
                                }}>
                                  <Trash2 size={13} /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Variation Notices */}
        {notices.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-[15px] font-medium text-[#111827]">Variation Notices</h2>
              <span className="text-[13px] text-[#4B5563]">{notices.filter(n => filterProject === 'all' || n.project_id === filterProject).length} notices</span>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden bg-[#FFFCF5] rounded-xl border border-[#D8D2C4] shadow-[0_1px_2px_rgba(17,24,39,0.04)] overflow-hidden divide-y divide-[#D8D2C4]">
              {notices
                .filter(n => filterProject === 'all' || n.project_id === filterProject)
                .map(n => {
                  const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
                    draft: { label: 'Draft', color: 'text-[#334155]', bg: 'bg-[#F5F2EA]', dot: 'bg-[#4B5563]' },
                    issued: { label: 'Issued', color: 'text-[#C75A00]', bg: 'bg-[#F5F2EA]', dot: 'bg-[#D8D2C4]' },
                    acknowledged: { label: 'Acknowledged', color: 'text-[#1F5223]', bg: 'bg-[#E5F0E6]', dot: 'bg-[#2E7D32]' },
                  };
                  const sc = statusConfig[n.status] || statusConfig.draft;
                  return (
                    <button key={n.id} className="w-full text-left" onClick={() => window.location.href = `/notice/${n.id}`}>
                      <div className="px-4 py-3 hover:bg-[#F5F2EA] transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] mono font-medium text-[#E76F00]">{n.notice_number}</div>
                            <div className="text-[14px] font-medium text-[#111827] mt-0.5 truncate">{n.event_description}</div>
                            <div className="text-[12px] text-[#4B5563] mt-0.5 truncate">{n.project_name}</div>
                          </div>
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${sc.bg} ${sc.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block bg-[#FFFCF5] rounded-xl border border-[#D8D2C4] shadow-[0_1px_2px_rgba(17,24,39,0.04)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#D8D2C4] bg-[#F5F2EA]/60">
                    <th className="text-left text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5">Notice No.</th>
                    <th className="text-left text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5">Description</th>
                    <th className="text-left text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5">Project</th>
                    <th className="text-left text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5">Status</th>
                    <th className="text-right text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5">Event Date</th>
                    <th className="text-right text-[11px] font-medium text-[#4B5563] uppercase tracking-wider px-3 md:px-4 py-3.5 hidden lg:table-cell">Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {notices
                    .filter(n => filterProject === 'all' || n.project_id === filterProject)
                    .map((n, i, arr) => {
                      const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
                        draft: { label: 'Draft', color: 'text-[#334155]', bg: 'bg-[#F5F2EA]', border: 'border-[#D8D2C4]', dot: 'bg-[#4B5563]' },
                        issued: { label: 'Issued', color: 'text-[#C75A00]', bg: 'bg-[#F5F2EA]', border: 'border-[#D8D2C4]', dot: 'bg-[#D8D2C4]' },
                        acknowledged: { label: 'Acknowledged', color: 'text-[#1F5223]', bg: 'bg-[#E5F0E6]', border: 'border-[#D8D2C4]', dot: 'bg-[#2E7D32]' },
                      };
                      const sc = statusConfig[n.status] || statusConfig.draft;
                      return (
                        <tr
                          key={n.id}
                          onClick={() => window.location.href = `/notice/${n.id}`}
                          className={`group border-b border-[#D8D2C4] hover:bg-[#F5F2EA] cursor-pointer transition-colors duration-[120ms] ease-out ${i === arr.length - 1 ? 'border-b-0' : ''}`}
                        >
                          <td className="px-3 md:px-4 py-3 text-[13px] font-medium text-[#111827] whitespace-nowrap">{n.notice_number}</td>
                          <td className="px-3 md:px-4 py-3 max-w-[260px] overflow-hidden">
                            <div className="truncate text-[14px] font-medium text-[#111827]">{n.event_description}</div>
                          </td>
                          <td className="px-3 md:px-4 py-3 text-[13px] text-[#111827]">{n.project_name}</td>
                          <td className="px-3 md:px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border ${sc.color} ${sc.bg} ${sc.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          </td>
                          <td className="px-3 md:px-4 py-3 text-[13px] text-[#111827] text-right whitespace-nowrap">{formatDate(n.event_date + 'T00:00:00')}</td>
                          <td className="px-3 md:px-4 py-3 text-[13px] text-[#111827] text-right hidden lg:table-cell whitespace-nowrap">{n.issued_at ? formatDate(n.issued_at) : <span className="text-[#4B5563]">—</span>}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over — opens when a table row is clicked */}
      <VariationSlideOver
        variationId={slideOverId}
        open={!!slideOverId}
        onClose={() => setSlideOverId(null)}
        onStatusChange={loadData}
      />
    </>
  );
}

export default function VariationsPage() {
  return (
    <AppShell>
      <Suspense fallback={<><TopBar title="Variation Register" /><div className="flex items-center justify-center h-96 text-[#4B5563] text-sm">Loading...</div></>}>
        <VariationsList />
      </Suspense>
    </AppShell>
  );
}
