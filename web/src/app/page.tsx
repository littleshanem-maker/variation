'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getStatusConfig } from '@/lib/utils';
import { printRegister } from '@/lib/print';
import type { Project, Variation } from '@/lib/types';

interface StatusSummary {
  status: string;
  label: string;
  count: number;
  total: number;
  border: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<(Project & { variations: Variation[] })[]>([]);
  const [recentVariations, setRecentVariations] = useState<(Variation & { project_name: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

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

    const allVariations = variationsData || [];
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
    setCreatingProject(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setCreatingProject(false); return; }

    const { error } = await supabase.from('projects').insert({
      id: crypto.randomUUID(),
      user_id: session.user.id,
      name: newProjectName.trim(),
      client: newProjectClient.trim(),
      reference: '',
      is_active: true,
    });

    if (!error) {
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
        <TopBar title="Variation Register" />
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
        <TopBar title="Variation Register" />
        <div className="flex items-center justify-center h-96">
          <p className="text-[#B25B4E] text-sm">Error: {error}</p>
        </div>
      </AppShell>
    );
  }

  const allVariations = projects.flatMap(p => p.variations);
  const statuses = ['captured', 'submitted', 'approved', 'paid', 'disputed'];
  const summaries: StatusSummary[] = statuses.map(s => {
    const config = getStatusConfig(s);
    const filtered = allVariations.filter(v => v.status === s);
    return {
      status: s,
      label: config.label,
      count: filtered.length,
      total: filtered.reduce((sum, v) => sum + v.estimated_value, 0),
      border: config.border,
    };
  });

  const atRiskVariations = allVariations.filter(v => v.status === 'disputed' || v.status === 'captured');
  summaries.push({
    status: 'at_risk',
    label: 'At Risk',
    count: atRiskVariations.length,
    total: atRiskVariations.reduce((sum, v) => sum + v.estimated_value, 0),
    border: 'border-[#C8943E]',
  });

  return (
    <AppShell>
      <TopBar title="Variation Register" onPrint={handlePrint} printLabel="Print / Export" />
      <div className="p-8 space-y-8">
        {/* Status Summary Boxes */}
        <div className="grid grid-cols-6 gap-4">
          {summaries.map(s => (
            <div key={s.status} className={`bg-white rounded-md border border-[#E5E7EB] border-t-[3px] ${s.border} p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]`}>
              <div className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-2">{s.label}</div>
              <div className="text-xl font-semibold text-[#1C1C1E] tabular-nums">{formatCurrency(s.total)}</div>
              <div className="text-[13px] text-[#6B7280] mt-1">
                {s.count} {s.count === 1 ? 'variation' : 'variations'}
              </div>
              <Link 
                href={`/variations?status=${s.status}`}
                className="text-[12px] text-[#1B365D] hover:text-[#24466F] mt-3 font-medium transition-colors duration-[120ms] ease-out inline-block"
              >
                View details →
              </Link>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-[#1C1C1E]">Projects</h2>
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#6B7280] bg-white border border-[#E5E7EB] rounded-md hover:bg-[#F5F3EF] transition-colors duration-[120ms] ease-out shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              + New Project
            </button>
          </div>
          {projects.length === 0 ? (
            <div className="bg-white rounded-md border border-[#E5E7EB] p-12 text-center text-[#9CA3AF] text-sm">
              No projects yet. Capture your first variation from the mobile app.
            </div>
          ) : (
            <div className="bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Project</th>
                    <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Client</th>
                    <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Variations</th>
                    <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Value</th>
                    <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">At Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, i) => {
                    const totalValue = p.variations.reduce((sum, v) => sum + v.estimated_value, 0);
                    const atRisk = p.variations
                      .filter(v => v.status === 'disputed' || v.status === 'captured')
                      .reduce((sum, v) => sum + v.estimated_value, 0);
                    return (
                      <Link key={p.id} href={`/project/${p.id}`} className="contents">
                        <tr className={`relative h-[44px] border-b border-[#F0F0EE] hover:bg-[#F5F3EF] cursor-pointer transition-colors duration-[120ms] ease-out ${i === projects.length - 1 ? 'border-b-0' : ''}`}>
                          <td className="px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E]">{p.name}</td>
                          <td className="px-5 py-2.5 text-[13px] text-[#6B7280]">{p.client}</td>
                          <td className="px-5 py-2.5 text-[13px] text-[#6B7280] text-right tabular-nums">{p.variations.length}</td>
                          <td className="px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E] text-right tabular-nums">{formatCurrency(totalValue)}</td>
                          <td className="px-5 py-2.5 text-[13px] text-right tabular-nums">{atRisk > 0 ? <span className="text-[#C8943E] font-medium">{formatCurrency(atRisk)}</span> : <span className="text-[#D1D5DB]">—</span>}</td>
                        </tr>
                      </Link>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-[#1C1C1E]">Recent Activity</h2>
            <span className="text-[12px] text-[#1B365D] font-medium">Last 10 variations</span>
          </div>
          {recentVariations.length === 0 ? (
            <div className="bg-white rounded-md border border-[#E5E7EB] p-12 text-center text-[#9CA3AF] text-sm">
              No variations captured yet.
            </div>
          ) : (
            <div className="bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Title</th>
                    <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Project</th>
                    <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Status</th>
                    <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Value</th>
                    <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVariations.map((v, i) => (
                    <Link key={v.id} href={`/variation/${v.id}`} className="contents">
                      <tr className={`relative h-[44px] border-b border-[#F0F0EE] hover:bg-[#F5F3EF] cursor-pointer transition-colors duration-[120ms] ease-out ${i === recentVariations.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E]">{v.title}</td>
                        <td className="px-5 py-2.5 text-[13px] text-[#6B7280]">{v.project_name}</td>
                        <td className="px-5 py-2.5"><StatusBadge status={v.status} /></td>
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
        {/* New Project Modal */}
        {showNewProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowNewProject(false)}>
            <div className="bg-white rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
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
    </AppShell>
  );
}
