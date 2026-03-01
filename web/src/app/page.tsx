'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getStatusConfig } from '@/lib/utils';
import { printRegister } from '@/lib/print';
import { useRole } from '@/lib/role';
import type { Project, Variation } from '@/lib/types';

interface StatusSummary {
  status: string;
  label: string;
  count: number;
  total: number;
  border: string;
  bg: string;
  color: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<(Project & { variations: Variation[] })[]>([]);
  const [allVariationsRaw, setAllVariationsRaw] = useState<Variation[]>([]);
  const [recentVariations, setRecentVariations] = useState<(Variation & { project_name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const { isField, isAdmin, isOffice, companyId, userId } = useRole();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setError('not_authenticated');
      setLoading(false);
      return;
    }

    const { data: projectsData, error: pErr } = await supabase
      .from('projects')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (pErr) { setError(pErr.message); setLoading(false); return; }

    const { data: variationsData, error: vErr } = await supabase
      .from('variations')
      .select('*')
      .order('captured_at', { ascending: false });

    if (vErr) { setError(vErr.message); setLoading(false); return; }

    const activeProjectIds = new Set((projectsData || []).map((p: Project) => p.id));
    const allVariations = (variationsData || []).filter((v: Variation) => activeProjectIds.has(v.project_id));
    setAllVariationsRaw(allVariations);
    const allProjects = (projectsData || []).map((p: Project) => ({
      ...p,
      variations: allVariations.filter((v: Variation) => v.project_id === p.id),
    }));

    setProjects(allProjects);

    const recent = allVariations.slice(0, 10).map((v: Variation) => {
      const proj = (projectsData || []).find((p: Project) => p.id === v.project_id);
      return { ...v, project_name: proj?.name || 'Unknown' };
    });
    setRecentVariations(recent);
    setLoading(false);
  }

  async function handleCreateProject() {
    if (!newProjectName.trim() || !newProjectClient.trim()) return;
    if (!companyId) { alert('Company not loaded yet. Please refresh and try again.'); return; }
    setCreatingProject(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setCreatingProject(false); return; }

    const { error } = await supabase.from('projects').insert({
      id: crypto.randomUUID(),
      created_by: session.user.id,
      company_id: companyId,
      name: newProjectName.trim(),
      client: newProjectClient.trim(),
      reference: '',
      is_active: true,
    });

    if (error) {
      console.error('Create project failed:', error);
      alert('Failed to create project: ' + error.message);
    } else {
      setNewProjectName('');
      setNewProjectClient('');
      setShowNewProject(false);
      loadData();
    }
    setCreatingProject(false);
  }

  function handlePrint() {
    printRegister(projects);
  }

  if (loading) {
    return (
      <AppShell>
        <TopBar title="Dashboard" />
        <div className="flex items-center justify-center h-96">
          <div className="text-[#9CA3AF] text-sm">Loading...</div>
        </div>
      </AppShell>
    );
  }

  if (error === 'not_authenticated') {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#9CA3AF] text-sm">Redirecting to login...</p>
      </div>
    );
  }

  if (error) {
    return (
      <AppShell>
        <TopBar title="Dashboard" />
        <div className="flex items-center justify-center h-96">
          <p className="text-[#B25B4E] text-sm">Error: {error}</p>
        </div>
      </AppShell>
    );
  }

  const allVariations = allVariationsRaw;
  const statuses = ['draft', 'submitted', 'approved', 'paid', 'disputed'];
  const summaries: StatusSummary[] = statuses.map(s => {
    const config = getStatusConfig(s);
    const filtered = s === 'draft'
      ? allVariations.filter(v => v.status === 'draft' || v.status === 'captured')
      : allVariations.filter(v => v.status === s);
    return {
      status: s,
      label: config.label,
      count: filtered.length,
      total: filtered.reduce((sum, v) => sum + (v.estimated_value || 0), 0),
      border: config.border,
      bg: config.bg,
      color: config.color,
    };
  });

  const atRiskVariations = allVariations.filter(v => v.status === 'disputed' || v.status === 'draft' || v.status === 'captured');
  summaries.push({
    status: 'at_risk',
    label: 'At Risk',
    count: atRiskVariations.length,
    total: atRiskVariations.reduce((sum, v) => sum + (v.estimated_value || 0), 0),
    border: 'border-[#C8943E]',
    bg: 'bg-[#FEF3C7]',
    color: 'text-[#92400E]',
  });

  return (
    <AppShell>
      <TopBar title="Dashboard" onPrint={isField ? undefined : handlePrint} printLabel="Print / Export" />
      <div className="p-4 md:p-8 space-y-6 md:space-y-8 pb-24 md:pb-8">
        {/* Status Summary Boxes */}
        <div className={`grid ${isField ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'} gap-3 md:gap-4`}>
          {summaries.map(s => (
            <div
              key={s.status}
              className={`rounded-md border border-t-[3px] ${s.border} ${s.bg} p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)]`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-widest text-current opacity-60 mb-2">
                {s.label}
              </div>
              {!isField && (
                <div className={`text-xl font-bold tabular-nums ${s.color}`}>
                  {formatCurrency(s.total)}
                </div>
              )}
              <div className="text-[12px] text-current opacity-60 mt-0.5">
                {s.count} {s.count === 1 ? 'var' : 'vars'}
              </div>
              <Link
                href={`/variations?status=${s.status}`}
                className={`text-[11px] font-semibold mt-3 inline-block ${s.color} opacity-80 hover:opacity-100`}
              >
                View →
              </Link>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div>
          <div className="flex items-center justify-between mb-4 md:mb-5">
            <h2 className="text-lg font-semibold text-[#1C1C1E]">Projects</h2>
            {!isField && (
              <button
                onClick={() => setShowNewProject(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#6B7280] bg-white border border-[#E5E7EB] rounded-md hover:bg-[#F5F3EF] transition-colors duration-[120ms] ease-out shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                + New Project
              </button>
            )}
          </div>
          {projects.length === 0 ? (
            <div className="bg-white rounded-md border border-[#E5E7EB] p-12 text-center text-[#9CA3AF] text-sm">
              No projects yet. Click <strong>+ New Project</strong> above to get started.
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="md:hidden space-y-2">
                {projects.map(p => {
                  const totalValue = p.variations.reduce((sum, v) => sum + (v.estimated_value || 0), 0);
                  const atRisk = p.variations
                    .filter(v => v.status === 'disputed' || v.status === 'draft' || v.status === 'captured')
                    .reduce((sum, v) => sum + (v.estimated_value || 0), 0);
                  return (
                    <Link key={p.id} href={`/project/${p.id}`}>
                      <div className="bg-white rounded-md border border-[#E5E7EB] px-4 py-3 flex items-center justify-between hover:bg-[#F5F3EF] transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                        <div className="min-w-0 mr-3">
                          <div className="text-[14px] font-semibold text-[#1C1C1E] truncate">{p.name}</div>
                          <div className="text-[12px] text-[#6B7280] mt-0.5 truncate">{p.client}</div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-[14px] font-semibold text-[#1C1C1E] tabular-nums">{formatCurrency(totalValue)}</div>
                          <div className="text-[12px] text-[#6B7280] tabular-nums mt-0.5">{p.variations.length} vars</div>
                          {atRisk > 0 && (
                            <div className="text-[11px] text-[#C8943E] font-medium tabular-nums">{formatCurrency(atRisk)} at risk</div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Desktop table — unchanged */}
              <div className="hidden md:block bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-[#E5E7EB]">
                        <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3">Project</th>
                        <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3">Client</th>
                        <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3">Vars</th>
                        {!isField && <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3">Value</th>}
                        {!isField && <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3 hidden md:table-cell">At Risk</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p, i) => {
                        const totalValue = p.variations.reduce((sum, v) => sum + (v.estimated_value || 0), 0);
                        const atRisk = p.variations
                          .filter(v => v.status === 'disputed' || v.status === 'draft' || v.status === 'captured')
                          .reduce((sum, v) => sum + (v.estimated_value || 0), 0);
                        return (
                          <Link key={p.id} href={`/project/${p.id}`} className="contents">
                            <tr className={`relative h-[44px] border-b border-[#F0F0EE] hover:bg-[#F5F3EF] cursor-pointer transition-colors duration-[120ms] ease-out ${i === projects.length - 1 ? 'border-b-0' : ''}`}>
                              <td className="px-4 md:px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E]">{p.name}</td>
                              <td className="px-4 md:px-5 py-2.5 text-[13px] text-[#6B7280]">{p.client}</td>
                              <td className="px-4 md:px-5 py-2.5 text-[13px] text-[#6B7280] text-right tabular-nums">{p.variations.length}</td>
                              {!isField && <td className="px-4 md:px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E] text-right tabular-nums">{formatCurrency(totalValue)}</td>}
                              {!isField && <td className="px-4 md:px-5 py-2.5 text-[13px] text-right tabular-nums hidden md:table-cell">{atRisk > 0 ? <span className="text-[#C8943E] font-medium">{formatCurrency(atRisk)}</span> : <span className="text-[#D1D5DB]">—</span>}</td>}
                            </tr>
                          </Link>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4 md:mb-5">
            <h2 className="text-lg font-semibold text-[#1C1C1E]">Recent Activity</h2>
            <span className="text-[12px] text-[#1B365D] font-medium">Last 10 variations</span>
          </div>
          {recentVariations.length === 0 ? (
            <div className="bg-white rounded-md border border-[#E5E7EB] p-12 text-center text-[#9CA3AF] text-sm">
              No variations captured yet.
            </div>
          ) : (
            <>
              {/* Mobile activity list */}
              <div className="md:hidden divide-y divide-[#F0F0EE] bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                {recentVariations.map(v => (
                  <Link key={v.id} href={`/variation/${v.id}`}>
                    <div className="px-4 py-3 flex items-center justify-between hover:bg-[#F5F3EF] transition-colors">
                      <div className="min-w-0 mr-3">
                        <div className="text-[14px] font-medium text-[#1C1C1E] truncate">{v.title}</div>
                        <div className="text-[12px] text-[#6B7280] mt-0.5 truncate">{v.project_name}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StatusBadge status={v.status} />
                        {!isField && (
                          <div className="text-[12px] text-[#6B7280] tabular-nums mt-1">{formatCurrency(v.estimated_value)}</div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop table — unchanged */}
              <div className="hidden md:block bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-[#E5E7EB]">
                        <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3">Title</th>
                        <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3 hidden md:table-cell">Project</th>
                        <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3">Status</th>
                        {!isField && <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3 hidden md:table-cell">Value</th>}
                        <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-4 md:px-5 py-3 hidden sm:table-cell">Captured</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentVariations.map((v, i) => (
                        <Link key={v.id} href={`/variation/${v.id}`} className="contents">
                          <tr className={`relative h-[44px] border-b border-[#F0F0EE] hover:bg-[#F5F3EF] cursor-pointer transition-colors duration-[120ms] ease-out ${i === recentVariations.length - 1 ? 'border-b-0' : ''}`}>
                            <td className="px-4 md:px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E]">{v.title}</td>
                            <td className="px-4 md:px-5 py-2.5 text-[13px] text-[#6B7280] hidden md:table-cell">{v.project_name}</td>
                            <td className="px-4 md:px-5 py-2.5"><StatusBadge status={v.status} /></td>
                            {!isField && <td className="px-4 md:px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E] text-right tabular-nums hidden md:table-cell">{formatCurrency(v.estimated_value)}</td>}
                            <td className="px-4 md:px-5 py-2.5 text-[13px] text-[#6B7280] text-right hidden sm:table-cell">{formatDate(v.captured_at)}</td>
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

        {/* New Project Modal */}
        {showNewProject && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowNewProject(false)}>
            <div className="bg-white rounded-t-xl sm:rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">New Project</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Project Name</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                    placeholder="e.g. Northern Hospital — Mechanical"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Client</label>
                  <input
                    type="text"
                    value={newProjectClient}
                    onChange={e => setNewProjectClient(e.target.value)}
                    className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                    placeholder="e.g. Lendlease"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setShowNewProject(false)}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors duration-[120ms]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={creatingProject || !newProjectName.trim() || !newProjectClient.trim()}
                  className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] disabled:opacity-40 transition-colors duration-[120ms]"
                >
                  {creatingProject ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button — Quick Capture */}
      {!loading && (
        <Link
          href="/capture"
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-[#E85D1A] hover:bg-[#C94E14] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-150"
          title="Quick Notice ⚡"
          aria-label="Quick Notice"
        >
          <span className="text-2xl">⚡</span>
        </Link>
      )}
    </AppShell>
  );
}
