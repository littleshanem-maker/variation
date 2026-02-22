'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { printProjectRegister } from '@/lib/print';
import type { Project, Variation } from '@/lib/types';

type SortKey = 'sequence_number' | 'title' | 'status' | 'instruction_source' | 'estimated_value' | 'captured_at';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('sequence_number');
  const [sortAsc, setSortAsc] = useState(true);

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
      <TopBar title={project.name} onPrint={handlePrint} printLabel="Print Register" />
      <div className="p-8 space-y-6">
        <div>
          <Link href="/" className="text-[12px] text-[#1B365D] hover:text-[#24466F] font-medium transition-colors duration-[120ms]">← Back to Dashboard</Link>
          <h2 className="text-xl font-semibold text-[#1C1C1E] mt-3">{project.name}</h2>
          <p className="text-[13px] text-[#6B7280] mt-1">{project.client} · {variations.length} variations · <span className="tabular-nums">{formatCurrency(totalValue)}</span> total value</p>
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
                  <SortHeader label="#" field="sequence_number" />
                  <SortHeader label="Title" field="title" />
                  <SortHeader label="Status" field="status" />
                  <SortHeader label="Instruction Source" field="instruction_source" />
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
    </AppShell>
  );
}
