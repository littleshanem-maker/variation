'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Project, Variation } from '@/lib/types';

export default function ArchivedProjects() {
  const [projects, setProjects] = useState<(Project & { variations: Variation[]; unarchiving?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: projectsData } = await supabase
      .from('projects')
      .select('*')
      .eq('is_active', false)
      .order('created_at', { ascending: false });

    if (!projectsData || projectsData.length === 0) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const projectIds = projectsData.map((p: Project) => p.id);
    const { data: variationsData } = await supabase
      .from('variations')
      .select('*')
      .in('project_id', projectIds);

    const allVariations = variationsData || [];
    const enriched = projectsData.map((p: Project) => ({
      ...p,
      variations: allVariations.filter((v: Variation) => v.project_id === p.id),
    }));

    setProjects(enriched);
    setLoading(false);
  }

  async function handleUnarchive(projectId: string) {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, unarchiving: true } : p));
    const supabase = createClient();
    const { error } = await supabase.from('projects').update({ is_active: true }).eq('id', projectId);
    if (!error) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } else {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, unarchiving: false } : p));
    }
  }

  if (loading) {
    return (
      <AppShell>
        <TopBar title="Archived Projects" />
        <div className="flex items-center justify-center h-96 text-[#64748B] text-sm">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar title="Archived Projects" />
      <div className="p-4 md:p-8 space-y-5 md:space-y-6">
        <div>
          <Link href="/dashboard" className="text-[12px] text-[#17212B] hover:text-[#334155] font-medium transition-colors duration-[120ms]">
            ← Back to Dashboard
          </Link>
          <div className="mt-3">
            <h2 className="text-xl font-semibold text-[#111827]">Archived Projects</h2>
            <p className="text-[13px] text-[#334155] mt-1">Projects archived from the dashboard. Unarchive to make them active again.</p>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-md border border-[#D8D2C4] p-12 text-center text-[#64748B] text-sm">
            No archived projects.
          </div>
        ) : (
          <div className="bg-white rounded-md border border-[#D8D2C4] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            {/* Mobile card layout */}
            <div className="md:hidden divide-y divide-[#E7E0D2]">
              {projects.map(p => {
                const totalValue = p.variations.reduce((sum, v) => sum + v.estimated_value, 0);
                return (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-[#111827] truncate">{p.name}</div>
                      <div className="text-[12px] text-[#334155] mt-0.5">{p.client} · {p.variations.length} vars · {formatCurrency(totalValue)}</div>
                    </div>
                    <button
                      onClick={() => handleUnarchive(p.id)}
                      disabled={p.unarchiving}
                      className="flex-shrink-0 px-3 py-1 text-[12px] font-medium text-[#334155] border border-[#D8D2C4] rounded hover:bg-[#F5F3EF] disabled:opacity-40 transition-colors duration-[120ms]"
                    >
                      {p.unarchiving ? 'Restoring...' : 'Unarchive'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#D8D2C4]">
                    <th className="text-left text-[11px] font-medium text-[#64748B] uppercase tracking-[0.02em] px-5 py-3">Project</th>
                    <th className="text-left text-[11px] font-medium text-[#64748B] uppercase tracking-[0.02em] px-5 py-3">Client</th>
                    <th className="text-right text-[11px] font-medium text-[#64748B] uppercase tracking-[0.02em] px-5 py-3">Variations</th>
                    <th className="text-right text-[11px] font-medium text-[#64748B] uppercase tracking-[0.02em] px-5 py-3">Total Value</th>
                    <th className="text-right text-[11px] font-medium text-[#64748B] uppercase tracking-[0.02em] px-5 py-3">Created</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, i) => {
                    const totalValue = p.variations.reduce((sum, v) => sum + v.estimated_value, 0);
                    return (
                      <tr
                        key={p.id}
                        className={`h-[44px] border-b border-[#E7E0D2] ${i === projects.length - 1 ? 'border-b-0' : ''}`}
                      >
                        <td className="px-5 py-2.5 text-[14px] font-medium text-[#111827]">{p.name}</td>
                        <td className="px-5 py-2.5 text-[13px] text-[#334155]">{p.client}</td>
                        <td className="px-5 py-2.5 text-[13px] text-[#334155] text-right tabular-nums">{p.variations.length}</td>
                        <td className="px-5 py-2.5 text-[14px] font-medium text-[#111827] text-right tabular-nums">{formatCurrency(totalValue)}</td>
                        <td className="px-5 py-2.5 text-[13px] text-[#334155] text-right">{formatDate(p.created_at)}</td>
                        <td className="px-5 py-2.5 text-right">
                          <button
                            onClick={() => handleUnarchive(p.id)}
                            disabled={p.unarchiving}
                            className="px-3 py-1 text-[12px] font-medium text-[#334155] border border-[#D8D2C4] rounded hover:bg-[#F5F3EF] disabled:opacity-40 transition-colors duration-[120ms]"
                          >
                            {p.unarchiving ? 'Restoring...' : 'Unarchive'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
