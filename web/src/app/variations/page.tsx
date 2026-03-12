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
import type { Variation, Project } from '@/lib/types';
import * as XLSX from 'xlsx';
import { MoreHorizontal, Pencil, Send, Trash2 } from 'lucide-react';

type SortKey = 'sequence_number' | 'title' | 'project_name' | 'status' | 'estimated_value' | 'captured_at' | 'response_due_date';

function VariationsList() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  const initialProject = searchParams.get('project') || 'all';

  const [variations, setVariations] = useState<(Variation & { project_name: string })[]>([]);
  const [rawProjects, setRawProjects] = useState<(Project & { variations: Variation[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('captured_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus);
  const [filterProject, setFilterProject] = useState<string>(initialProject);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [slideOverId, setSlideOverId] = useState<string | null>(null);
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

    if (vars) {
      const activeVars = vars.filter(v => activeProjectIds.has(v.project_id));
      const enriched = activeVars.map(v => ({
        ...v,
        project_name: projectMap.get(v.project_id) || 'Unknown Project'
      }));
      setVariations(enriched);

      const projectsWithVars = (projects || []).map(p => ({
        ...p,
        variations: activeVars.filter(v => v.project_id === p.id),
      }));
      setRawProjects(projectsWithVars);
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
      className={`${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-medium text-slate-500 uppercase tracking-wider px-5 md:px-6 py-3.5 cursor-pointer hover:text-slate-700 select-none transition-colors duration-[120ms] ${className}`}
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

      'Value (AUD)': (v.estimated_value || 0) / 100,
      'Captured': v.captured_at ? new Date(v.captured_at).toLocaleDateString('en-AU') : '',
      'Due Date': v.response_due_date ? (() => { const d = new Date(v.response_due_date + 'T00:00:00'); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`; })() : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 10 }, { wch: 40 }, { wch: 30 }, { wch: 12 },
      { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
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
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading) {
    return (
      <>
        <TopBar title="Variation Register" />
        <div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Loading...</div>
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
      <div className="p-4 md:p-8 space-y-5 md:space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-[#1C1C1E]">Variation Register</h2>
          <p className="text-[13px] text-[#6B7280] mt-1">
            {filtered.length} variations · <span className="tabular-nums">{formatCurrency(totalValue)}</span> total value
          </p>
        </div>

        {/* Filters row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Status tabs — horizontally scrollable on mobile */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex bg-[#F0F0EE] p-1 rounded-md w-max">
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
                      ? 'bg-white text-[#1C1C1E] shadow-sm'
                      : 'text-[#6B7280] hover:text-[#1C1C1E]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Project filter dropdown */}
          <select
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
            className="px-3 py-1.5 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#374151] focus:outline-none focus:ring-1 focus:ring-[#1B365D] shadow-[0_1px_2px_rgba(0,0,0,0.04)] w-full sm:w-auto"
          >
            <option value="all">All Projects</option>
            {rawProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Export to Excel */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] rounded-md hover:bg-[#DCFCE7] transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)] whitespace-nowrap"
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-md hover:bg-[#FEE2E2] transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)] whitespace-nowrap disabled:opacity-50 disabled:cursor-wait"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            {exportingPdf ? 'Generating…' : 'Export PDF'}
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-12 text-center text-[#9CA3AF] text-sm">
            No variations match this filter.
          </div>
        ) : (
          <>
            {/* Mobile cards — md:hidden */}
            <div className="md:hidden divide-y divide-[#F0F0EE] bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              {sorted.map(v => (
                <button key={v.id} className="w-full text-left" onClick={() => setSlideOverId(v.id)}>
                  <div className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-mono font-semibold text-indigo-600">{getVariationNumber(v)}</div>
                        <div className="text-[14px] font-medium text-slate-800 mt-0.5 truncate">{v.title}</div>
                        <div className="text-[12px] text-slate-400 mt-0.5 truncate">{v.project_name}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StatusBadge status={v.status} />
                        <div className="text-[13px] font-medium text-slate-700 mt-1">{formatCurrency(v.estimated_value)}</div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop table — hidden md:block */}
            <div className="hidden md:block bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-slate-50/60">
                      <SortHeader label="Var No." field="sequence_number" />
                      <SortHeader label="Title" field="title" />
                      <SortHeader label="Project" field="project_name" className="hidden md:table-cell" />
                      <SortHeader label="Status" field="status" />

                      <SortHeader label="Value" field="estimated_value" align="right" className="hidden sm:table-cell" />
                      <SortHeader label="Captured" field="captured_at" align="right" className="hidden md:table-cell" />
                      <SortHeader label="Due Date" field="response_due_date" align="right" className="hidden lg:table-cell" />
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((v, i) => (
                      <tr
                        key={v.id}
                        onClick={() => setSlideOverId(v.id)}
                        className={`group relative border-b border-[#F0F0EE] hover:bg-slate-50 cursor-pointer transition-colors duration-[120ms] ease-out ${i === sorted.length - 1 ? 'border-b-0' : ''}`}
                      >
                        <td className="px-5 md:px-6 py-3 text-[13px] font-medium text-[#1C1C1E] tabular-nums whitespace-nowrap">
                          {getVariationNumber(v)}
                        </td>
                        <td className="px-5 md:px-6 py-3 max-w-[200px] overflow-hidden">
                          <div className="truncate text-[14px] font-medium text-[#1C1C1E]">{v.title}</div>
                        </td>
                        <td className="px-5 md:px-6 py-3 max-w-[160px] overflow-hidden hidden md:table-cell"><div className="truncate text-[13px] text-[#1C1C1E]">{v.project_name}</div></td>
                        <td className="px-5 md:px-6 py-3"><StatusBadge status={v.status} /></td>

                        <td className="px-5 md:px-6 py-3 text-[14px] font-medium text-[#1C1C1E] text-right tabular-nums hidden sm:table-cell whitespace-nowrap">{formatCurrency(v.estimated_value)}</td>
                        <td className="px-5 md:px-6 py-3 text-[13px] text-[#1C1C1E] text-right hidden md:table-cell whitespace-nowrap">{formatDate(v.captured_at)}</td>
                        <td className="px-5 md:px-6 py-3 text-right hidden lg:table-cell whitespace-nowrap">
                            {v.response_due_date ? (() => {
                              const due = new Date(v.response_due_date + 'T00:00:00');
                              const today = new Date(); today.setHours(0,0,0,0);
                              const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
                              const overdue = daysLeft < 0;
                              const dueSoon = daysLeft >= 0 && daysLeft <= 3;
                              return (
                                <span className={`text-[13px] font-medium ${overdue ? 'text-[#DC2626]' : dueSoon ? 'text-[#D97706]' : 'text-[#1C1C1E]'}`}>
                                  {`${String(due.getDate()).padStart(2,'0')}/${String(due.getMonth()+1).padStart(2,'0')}/${String(due.getFullYear()).slice(-2)}`}
                                </span>
                              );
                            })() : <span className="text-[13px] text-[#D1D5DB]">—</span>}
                          </td>
                          {/* Ellipsis action menu */}
                          <td className="px-3 py-3 w-10" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all"
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
      <Suspense fallback={<><TopBar title="Variation Register" /><div className="flex items-center justify-center h-96 text-[#9CA3AF] text-sm">Loading...</div></>}>
        <VariationsList />
      </Suspense>
    </AppShell>
  );
}
