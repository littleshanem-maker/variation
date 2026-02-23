'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getStatusConfig } from '@/lib/utils';
import { printRegister } from '@/lib/print';
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

  useEffect(() => {
    loadData();
  }, []);

  // Update filter if URL changes (e.g. back/forward nav)
  useEffect(() => {
    setFilterStatus(searchParams.get('status') || 'all');
  }, [searchParams]);

  async function loadData() {
    const supabase = createClient();
    
    const { data: projects } = await supabase.from('projects').select('*');
    const projectMap = new Map(projects?.map(p => [p.id, p.name]));

    const { data: vars } = await supabase
      .from('variations')
      .select('*')
      .order('captured_at', { ascending: false });

    if (vars) {
      const enriched = vars.map(v => ({
        ...v,
        project_name: projectMap.get(v.project_id) || 'Unknown Project'
      }));
      setVariations(enriched);

      const projectsWithVars = (projects || []).map(p => ({
        ...p,
        variations: vars.filter(v => v.project_id === p.id),
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
    if (filterStatus === 'at_risk') return v.status === 'disputed' || v.status === 'captured';
    return v.status === filterStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey]; const bVal = b[sortKey];
    if (aVal == null) return 1; if (bVal == null) return -1;
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const totalValue = filtered.reduce((sum, v) => sum + v.estimated_value, 0);

  const SortHeader = ({ label, field, align }: { label: string; field: SortKey; align?: 'right' }) => (
    <th
      className={`${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3 cursor-pointer hover:text-[#6B7280] select-none transition-colors duration-[120ms]`}
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
    { value: 'all', label: 'All Variations' },
    { value: 'captured', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'approved', label: 'Approved' },
    { value: 'paid', label: 'Paid' },
    { value: 'disputed', label: 'Disputed' },
    { value: 'at_risk', label: 'At Risk' },
  ];

  return (
    <>
    <TopBar title="Variation Register" onPrint={handlePrint} printLabel="Print / Export" />
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-[12px] text-[#1B365D] hover:text-[#24466F] font-medium transition-colors duration-[120ms]">← Back to Dashboard</Link>
          <h2 className="text-xl font-semibold text-[#1C1C1E] mt-3">Variation Register</h2>
          <p className="text-[13px] text-[#6B7280] mt-1">
            {filtered.length} variations · <span className="tabular-nums">{formatCurrency(totalValue)}</span> total value
          </p>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex bg-[#F0F0EE] p-1 rounded-md">
          {statuses.map(s => (
            <button
              key={s.value}
              onClick={() => {
                setFilterStatus(s.value);
                // Update URL without reload
                const url = new URL(window.location.href);
                url.searchParams.set('status', s.value);
                window.history.pushState({}, '', url);
              }}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-sm transition-all duration-[120ms] ${
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
        <div className="bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <SortHeader label="#" field="sequence_number" />
                <SortHeader label="Title" field="title" />
                <SortHeader label="Project" field="project_name" />
                <SortHeader label="Status" field="status" />
                <SortHeader label="Source" field="instruction_source" />
                <SortHeader label="Value" field="estimated_value" align="right" />
                <SortHeader label="Captured" field="captured_at" align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((v, i) => (
                <Link key={v.id} href={`/variation/${v.id}`} className="contents">
                  <tr className={`relative h-[44px] border-b border-[#F0F0EE] hover:bg-[#F5F3EF] cursor-pointer transition-colors duration-[120ms] ease-out ${i === sorted.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-5 py-2.5 text-[13px] text-[#9CA3AF] tabular-nums">{v.sequence_number}</td>
                    <td className="px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E]">{v.title}</td>
                    <td className="px-5 py-2.5 text-[13px] text-[#6B7280]">{v.project_name}</td>
                    <td className="px-5 py-2.5"><StatusBadge status={v.status} /></td>
                    <td className="px-5 py-2.5 text-[13px] text-[#6B7280] capitalize">{v.instruction_source?.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E] text-right tabular-nums">{formatCurrency(v.estimated_value)}</td>
                    <td className="px-5 py-2.5 text-[13px] text-[#6B7280] text-right">{formatDate(v.captured_at)}</td>
                  </tr>
                </Link>
              ))}
            </tbody>
          </table>
        </div>
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
