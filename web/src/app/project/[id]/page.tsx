'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sorted = [...variations].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3 cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  if (loading) {
    return (
      <AppShell>
        <TopBar title="Project" />
        <div className="flex items-center justify-center h-96 text-gray-400">Loading...</div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <TopBar title="Project" />
        <div className="flex items-center justify-center h-96 text-gray-400">Project not found</div>
      </AppShell>
    );
  }

  const totalValue = variations.reduce((sum, v) => sum + v.estimated_value, 0);

  return (
    <AppShell>
      <TopBar title={project.name} />
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-sm text-blue-600 hover:text-blue-800 font-medium">← Back to Dashboard</Link>
            <h2 className="text-2xl font-bold text-gray-900 mt-2">{project.name}</h2>
            <p className="text-gray-500">{project.client} · {variations.length} variations · {formatCurrency(totalValue)} total value</p>
          </div>
        </div>

        {/* Variations Table */}
        {variations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No variations captured for this project yet.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <SortHeader label="#" field="sequence_number" />
                  <SortHeader label="Title" field="title" />
                  <SortHeader label="Status" field="status" />
                  <SortHeader label="Instruction Source" field="instruction_source" />
                  <th
                    className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3 cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => handleSort('estimated_value')}
                  >
                    Value {sortKey === 'estimated_value' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th
                    className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3 cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => handleSort('captured_at')}
                  >
                    Captured {sortKey === 'captured_at' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(v => (
                  <Link key={v.id} href={`/variation/${v.id}`} className="contents">
                    <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono">{v.sequence_number}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{v.title}</td>
                      <td className="px-6 py-4"><StatusBadge status={v.status} /></td>
                      <td className="px-6 py-4 text-sm text-gray-500 capitalize">{v.instruction_source?.replace(/_/g, ' ')}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">{formatCurrency(v.estimated_value)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 text-right">{formatDate(v.captured_at)}</td>
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
