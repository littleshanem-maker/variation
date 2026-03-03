'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getStatusConfig, getVariationNumber } from '@/lib/utils';
import { printRegister, getFilteredRegisterHtml } from '@/lib/print';
import { htmlToPdfBlob } from '@/lib/pdf';
import { useRole } from '@/lib/role';
import type { Variation, Project } from '@/lib/types';
import * as XLSX from 'xlsx';

type SortKey = 'sequence_number' | 'title' | 'project_name' | 'status' | 'instruction_source' | 'estimated_value' | 'captured_at';

function VariationsList() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';

  const [variations, setVariations] = useState<(Variation & { project_name: string })[]>([]);
  const [rawProjects, setRawProjects] = useState<(Project & { variations: Variation[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('captured_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [exportingPdf, setExportingPdf] = useState(false);
  const { isField } = useRole();

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
      className={`${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3 cursor-pointer hover:text-[#6B7280] select-none transition-colors duration-[120ms] ${className}`}
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  function handlePrint() {
    printRegister(rawProjects);
  }

  function handleExportExcel() {
    const rows = sorted.map(v => ({
      'Var No.': getVariationNumber(v),
      'Title': v.title,
      'Project': v.project_name,
      'Status': v.status.charAt(0).toUpperCase() + v.status.slice(1),
      'Source': v.instruction_source?.replace(/_/g, ' ') || '',
      'Value (AUD)': (v.estimated_value || 0) / 100,
      'Captured': v.captured_at ? new Date(v.captured_at).toLocaleDateString('en-AU') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 10 }, { wch: 40 }, { wch: 30 }, { wch: 12 },
      { wch: 20 }, { wch: 14 }, { wch: 14 },
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

      const { html, css } = getFilteredRegisterHtml(sorted, label);
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
      <TopBar title="Variation Register" onPrint={handlePrint} printLabel="Print / Export" />
      <div className="p-4 md:p-8 space-y-5 md:space-y-6">
        <div>
          <Link
            href="/"
            className="flex items-center gap-2 w-full bg-white border border-[#E5E7EB] rounded-md px-4 py-3 text-[14px] font-semibold text-[#1B365D] hover:bg-[#F0F4FA] active:bg-[#E8EFF8] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Dashboard
          </Link>
          <h2 className="text-xl font-semibold text-[#1C1C1E] mt-3">Variation Register</h2>
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
                <Link key={v.id} href={`/variation/${v.id}`}>
                  <div className="px-4 py-3 hover:bg-[#F5F3EF] transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-mono font-bold text-[#1B365D]">{getVariationNumber(v)}</div>
                        <div className="text-[14px] font-medium text-[#1C1C1E] mt-0.5 truncate">{v.title}</div>
                        <div className="text-[12px] text-[#9CA3AF] mt-0.5 truncate">{v.project_name}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StatusBadge status={v.status} />
                        <div className="text-[13px] font-medium text-[#1C1C1E] tabular-nums mt-1">{formatCurrency(v.estimated_value)}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table — hidden md:block */}
            <div className="hidden md:block bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      <SortHeader label="Var No." field="sequence_number" />
                      <SortHeader label="Title" field="title" />
                      <SortHeader label="Project" field="project_name" className="hidden md:table-cell" />
                      <SortHeader label="Status" field="status" />
                      <SortHeader label="Source" field="instruction_source" className="hidden lg:table-cell" />
                      <SortHeader label="Value" field="estimated_value" align="right" className="hidden sm:table-cell" />
                      <SortHeader label="Captured" field="captured_at" align="right" className="hidden md:table-cell" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((v, i) => (
                      <Link key={v.id} href={`/variation/${v.id}`} className="contents">
                        <tr className={`relative h-[44px] border-b border-[#F0F0EE] hover:bg-[#F5F3EF] cursor-pointer transition-colors duration-[120ms] ease-out ${i === sorted.length - 1 ? 'border-b-0' : ''}`}>
                          <td className="px-4 md:px-5 py-2.5 text-[13px] font-mono font-medium text-[#1B365D] tabular-nums whitespace-nowrap">{getVariationNumber(v)}</td>
                          <td className="px-4 md:px-5 py-2.5 max-w-[200px] overflow-hidden"><div className="truncate text-[14px] font-medium text-[#1C1C1E]">{v.title}</div></td>
                          <td className="px-4 md:px-5 py-2.5 max-w-[160px] overflow-hidden hidden md:table-cell"><div className="truncate text-[13px] text-[#6B7280]">{v.project_name}</div></td>
                          <td className="px-4 md:px-5 py-2.5"><StatusBadge status={v.status} /></td>
                          <td className="px-4 md:px-5 py-2.5 text-[13px] text-[#6B7280] capitalize hidden lg:table-cell whitespace-nowrap">{v.instruction_source?.replace(/_/g, ' ')}</td>
                          <td className="px-4 md:px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E] text-right tabular-nums hidden sm:table-cell whitespace-nowrap">{formatCurrency(v.estimated_value)}</td>
                          <td className="px-4 md:px-5 py-2.5 text-[13px] text-[#6B7280] text-right hidden md:table-cell whitespace-nowrap">{formatDate(v.captured_at)}</td>
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
