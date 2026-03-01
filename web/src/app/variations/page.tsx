'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getStatusConfig, getVariationNumber } from '@/lib/utils';
import { printRegister } from '@/lib/print';
import { useRole } from '@/lib/role';
import type { Variation, Project } from '@/lib/types';

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
    if (filterStatus === 'all') return true;
    if (filterStatus === 'at_risk') return v.status === 'disputed' || v.status === 'draft' || v.status === 'captured';
    if (filterStatus === 'draft') return v.status === 'draft' || v.status === 'captured';
    return v.status === filterStatus;
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
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors py-2 -my-2 group"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="group-hover:-translate-x-0.5 transition-transform">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Dashboard
          </Link>
          <h2 className="text-xl font-semibold text-[#1C1C1E] mt-3">Variation Register</h2>
          <p className="text-[13px] text-[#6B7280] mt-1">
            {filtered.length} variations · <span className="tabular-nums">{formatCurrency(totalValue)}</span> total value
          </p>
        </div>

        {/* Filter Tabs — horizontally scrollable on mobile */}
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex bg-[#F0F0EE] p-1 rounded-md w-max md:w-auto">
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
