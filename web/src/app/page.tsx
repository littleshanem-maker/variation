'use client';

import { useEffect, useState, useMemo } from 'react';
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

type DateRangeKey = 'all' | 'week' | 'month' | '30d' | '90d';

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function filterByDateRange(variations: Variation[], range: DateRangeKey): Variation[] {
  if (range === 'all') return variations;
  const now = Date.now();
  const ms: Record<DateRangeKey, number> = {
    all: 0,
    week: 7 * 86400000,
    month: 30 * 86400000,
    '30d': 30 * 86400000,
    '90d': 90 * 86400000,
  };
  const cutoff = now - ms[range];
  return variations.filter(v => new Date(v.captured_at).getTime() >= cutoff);
}

export default function Dashboard() {
  const [projects, setProjects] = useState<(Project & { variations: Variation[] })[]>([]);
  const [allVariationsRaw, setAllVariationsRaw] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectClient, setNewProjectClient] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Global filters
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<DateRangeKey>('all');
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);

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

  // --- Derived / filtered data ---
  const filteredVariations = useMemo(() => {
    let vars = allVariationsRaw;
    if (filterProject !== 'all') {
      vars = vars.filter(v => v.project_id === filterProject);
    }
    vars = filterByDateRange(vars, filterDateRange);
    return vars;
  }, [allVariationsRaw, filterProject, filterDateRange]);

  const statuses = ['draft', 'submitted', 'approved', 'paid', 'disputed'];
  const summaries: StatusSummary[] = useMemo(() => {
    const base = statuses.map(s => {
      const config = getStatusConfig(s);
      const filtered = s === 'draft'
        ? filteredVariations.filter(v => v.status === 'draft' || v.status === 'captured')
        : filteredVariations.filter(v => v.status === s);
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

    const atRiskVariations = filteredVariations.filter(v =>
      v.status === 'disputed' || v.status === 'draft' || v.status === 'captured'
    );
    base.push({
      status: 'at_risk',
      label: 'At Risk',
      count: atRiskVariations.length,
      total: atRiskVariations.reduce((sum, v) => sum + (v.estimated_value || 0), 0),
      border: 'border-[#DC2626]',
      bg: 'bg-[#FEF2F2]',
      color: 'text-[#DC2626]',
    });
    return base;
  }, [filteredVariations]);

  // Sub-metrics for KPI cards
  const atRiskVars = filteredVariations.filter(v =>
    v.status === 'disputed' || v.status === 'draft' || v.status === 'captured'
  );
  const avgAtRiskDays = atRiskVars.length > 0
    ? Math.round(atRiskVars.reduce((sum, v) => sum + daysSince(v.captured_at), 0) / atRiskVars.length)
    : 0;

  const submittedVars = filteredVariations.filter(v => v.status === 'submitted');
  const avgSubmittedDays = submittedVars.length > 0
    ? Math.round(submittedVars.reduce((sum, v) => sum + daysSince(v.captured_at), 0) / submittedVars.length)
    : 0;

  const totalValue = filteredVariations.reduce((sum, v) => sum + (v.estimated_value || 0), 0);
  const disputedTotal = filteredVariations
    .filter(v => v.status === 'disputed')
    .reduce((sum, v) => sum + (v.estimated_value || 0), 0);
  const disputedPct = totalValue > 0 ? Math.round((disputedTotal / totalValue) * 100) : 0;

  function getSubMetric(status: string, count: number): string | null {
    if (status === 'at_risk') return count > 0 ? `avg ${avgAtRiskDays}d pending` : null;
    if (status === 'submitted') return count > 0 ? `avg ${avgSubmittedDays}d pending` : null;
    if (status === 'disputed') return `${disputedPct}% of total value`;
    return null;
  }

  // --- Stacked bar chart data ---
  type ProjectBarData = {
    id: string;
    name: string;
    totalValue: number;
    paid: number;
    submitted: number;
    disputed: number;
    other: number;
  };

  const barChartData: ProjectBarData[] = useMemo(() => {
    return projects
      .map(p => {
        const vars = filterProject !== 'all' && p.id !== filterProject
          ? []
          : filterByDateRange(p.variations, filterDateRange);
        const paid = vars.filter(v => v.status === 'paid').reduce((s, v) => s + (v.estimated_value || 0), 0);
        const submitted = vars.filter(v => v.status === 'submitted').reduce((s, v) => s + (v.estimated_value || 0), 0);
        const disputed = vars.filter(v => v.status === 'disputed').reduce((s, v) => s + (v.estimated_value || 0), 0);
        const other = vars.filter(v => ['draft', 'captured', 'approved'].includes(v.status)).reduce((s, v) => s + (v.estimated_value || 0), 0);
        const totalValue = paid + submitted + disputed + other;
        return { id: p.id, name: p.name, totalValue, paid, submitted, disputed, other };
      })
      .filter(p => p.totalValue > 0 || filterProject === p.id)
      .sort((a, b) => b.disputed - a.disputed || b.submitted - a.submitted);
  }, [projects, filterProject, filterDateRange]);

  // --- Urgent Attention Feed ---
  type UrgentItem = Variation & { project_name: string; daysOld: number; flagType: 'overdue' | 'disputed' | 'highValue' };

  const urgentItems: UrgentItem[] = useMemo(() => {
    const seen = new Set<string>();
    const items: UrgentItem[] = [];

    // Apply KPI filter if active
    let vars = filteredVariations;
    if (activeKpiFilter === 'at_risk') {
      vars = vars.filter(v => v.status === 'disputed' || v.status === 'draft' || v.status === 'captured');
    } else if (activeKpiFilter && activeKpiFilter !== 'at_risk') {
      vars = vars.filter(v => v.status === activeKpiFilter);
    }

    for (const v of vars) {
      const proj = projects.find(p => p.id === v.project_id);
      const daysOld = daysSince(v.captured_at);

      let flagType: UrgentItem['flagType'] | null = null;
      if (v.status === 'disputed') flagType = 'disputed';
      else if (v.status === 'submitted' && daysOld > 7) flagType = 'overdue';
      else if (v.status === 'submitted' && (v.estimated_value || 0) > 1_000_000) flagType = 'highValue';

      if (flagType && !seen.has(v.id)) {
        seen.add(v.id);
        items.push({ ...v, project_name: proj?.name || 'Unknown', daysOld, flagType });
      }
    }

    // Sort: disputed first, then by value desc
    return items.sort((a, b) => {
      if (a.flagType === 'disputed' && b.flagType !== 'disputed') return -1;
      if (b.flagType === 'disputed' && a.flagType !== 'disputed') return 1;
      return (b.estimated_value || 0) - (a.estimated_value || 0);
    });
  }, [filteredVariations, projects, activeKpiFilter]);

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
    if (typeof window !== 'undefined') window.location.href = '/login';
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

  return (
    <AppShell>
      <TopBar title="Dashboard" onPrint={isField ? undefined : handlePrint} printLabel="Print / Export" />

      <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">

        {/* ── Global Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
            className="px-3 py-1.5 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#374151] focus:outline-none focus:ring-1 focus:ring-[#1B365D] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={filterDateRange}
            onChange={e => setFilterDateRange(e.target.value as DateRangeKey)}
            className="px-3 py-1.5 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#374151] focus:outline-none focus:ring-1 focus:ring-[#1B365D] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <option value="all">All Time</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>

          <select
            value="all"
            disabled
            className="px-3 py-1.5 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#9CA3AF] shadow-[0_1px_2px_rgba(0,0,0,0.04)] opacity-60 cursor-not-allowed"
          >
            <option value="all">All PMs</option>
          </select>

          {(filterProject !== 'all' || filterDateRange !== 'all' || activeKpiFilter) && (
            <button
              onClick={() => { setFilterProject('all'); setFilterDateRange('all'); setActiveKpiFilter(null); }}
              className="px-3 py-1.5 text-[12px] font-medium text-[#6B7280] hover:text-[#DC2626] border border-[#E5E7EB] rounded-md bg-white transition-colors"
            >
              Clear filters ×
            </button>
          )}
        </div>

        {/* ── KPI Cards ── */}
        <div className={`grid ${isField ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'} gap-3 md:gap-4`}>
          {summaries.map(s => {
            const isActive = activeKpiFilter === s.status;
            const isAtRisk = s.status === 'at_risk';
            const subMetric = getSubMetric(s.status, s.count);

            return (
              <button
                key={s.status}
                onClick={() => setActiveKpiFilter(isActive ? null : s.status)}
                className={`
                  rounded-md border border-t-[3px] ${s.border} ${s.bg} p-4
                  shadow-[0_1px_2px_rgba(0,0,0,0.06)] text-left
                  hover:brightness-95 transition-all duration-[120ms] active:scale-[0.98]
                  ${isActive ? 'ring-2 ring-offset-1 ring-[#1B365D]' : ''}
                `}
              >
                <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-current opacity-70 mb-1.5">
                  {s.label}
                </div>
                {!isField && (
                  <div className={`
                    tabular-nums leading-tight
                    ${isAtRisk
                      ? 'text-[28px] font-black text-[#DC2626]'
                      : `text-[22px] font-extrabold ${s.color}`}
                  `}>
                    {formatCurrency(s.total)}
                  </div>
                )}
                <div className="text-[12px] text-current opacity-60 mt-0.5">
                  {s.count} {s.count === 1 ? 'var' : 'vars'}
                </div>
                {subMetric && (
                  <div className={`text-[11px] mt-1 font-medium ${isAtRisk ? 'text-[#DC2626] opacity-80' : 'opacity-60 text-current'}`}>
                    {subMetric}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Projects section ── */}
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
                  const totalVal = p.variations.reduce((sum, v) => sum + (v.estimated_value || 0), 0);
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
                          <div className="text-[14px] font-semibold text-[#1C1C1E] tabular-nums">{formatCurrency(totalVal)}</div>
                          <div className="text-[12px] text-[#6B7280] tabular-nums mt-0.5">{p.variations.length} vars</div>
                          {atRisk > 0 && (
                            <div className="text-[11px] text-[#DC2626] font-medium tabular-nums">{formatCurrency(atRisk)} at risk</div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Desktop: Stacked Bar Chart */}
              {!isField && (
                <div className="hidden md:block bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden p-5 space-y-3">
                  {barChartData.length === 0 ? (
                    <p className="text-[13px] text-[#9CA3AF] text-center py-4">No variation data to display.</p>
                  ) : (
                    barChartData.map(p => {
                      const maxVal = Math.max(...barChartData.map(x => x.totalValue), 1);
                      const barWidth = (p.totalValue / maxVal) * 100;
                      const paidPct = p.totalValue > 0 ? (p.paid / p.totalValue) * 100 : 0;
                      const submittedPct = p.totalValue > 0 ? (p.submitted / p.totalValue) * 100 : 0;
                      const disputedPct = p.totalValue > 0 ? (p.disputed / p.totalValue) * 100 : 0;
                      const otherPct = p.totalValue > 0 ? (p.other / p.totalValue) * 100 : 0;
                      return (
                        <div key={p.id} className="flex items-center gap-3 group">
                          <Link
                            href={`/project/${p.id}`}
                            className="w-[180px] flex-shrink-0 text-[13px] font-medium text-[#1C1C1E] truncate hover:text-[#1B365D] transition-colors"
                            title={p.name}
                          >
                            {p.name}
                          </Link>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-7 bg-[#F3F4F6] rounded overflow-hidden flex">
                              <div
                                style={{ width: `${barWidth}%` }}
                                className="flex h-full"
                              >
                                {paidPct > 0 && (
                                  <div
                                    style={{ width: `${paidPct}%` }}
                                    className="bg-[#22C55E] h-full transition-all duration-300"
                                    title={`Paid: ${formatCurrency(p.paid)}`}
                                  />
                                )}
                                {submittedPct > 0 && (
                                  <div
                                    style={{ width: `${submittedPct}%` }}
                                    className="bg-[#EAB308] h-full transition-all duration-300"
                                    title={`Submitted: ${formatCurrency(p.submitted)}`}
                                  />
                                )}
                                {disputedPct > 0 && (
                                  <div
                                    style={{ width: `${disputedPct}%` }}
                                    className="bg-[#DC2626] h-full transition-all duration-300"
                                    title={`Disputed: ${formatCurrency(p.disputed)}`}
                                  />
                                )}
                                {otherPct > 0 && (
                                  <div
                                    style={{ width: `${otherPct}%` }}
                                    className="bg-[#D1D5DB] h-full transition-all duration-300"
                                    title={`Draft/Approved: ${formatCurrency(p.other)}`}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="w-[140px] flex-shrink-0 text-right">
                            <div className="text-[13px] font-medium text-[#1C1C1E] tabular-nums">{formatCurrency(p.totalValue)}</div>
                            {p.disputed > 0 && (
                              <div className="text-[11px] text-[#DC2626] font-medium tabular-nums">{formatCurrency(p.disputed)} disputed</div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {/* Legend */}
                  <div className="flex items-center gap-4 pt-2 border-t border-[#F0F0EE]">
                    {[
                      { color: 'bg-[#22C55E]', label: 'Paid' },
                      { color: 'bg-[#EAB308]', label: 'Submitted' },
                      { color: 'bg-[#DC2626]', label: 'Disputed' },
                      { color: 'bg-[#D1D5DB]', label: 'Draft / Approved' },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                        <span className="text-[11px] text-[#6B7280]">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Field users on desktop: keep a simple table */}
              {isField && (
                <div className="hidden md:block bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E5E7EB]">
                        <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Project</th>
                        <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Client</th>
                        <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-3">Vars</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p, i) => (
                        <Link key={p.id} href={`/project/${p.id}`} className="contents">
                          <tr className={`h-[44px] border-b border-[#F0F0EE] hover:bg-[#F5F3EF] cursor-pointer transition-colors ${i === projects.length - 1 ? 'border-b-0' : ''}`}>
                            <td className="px-5 py-2.5 text-[14px] font-medium text-[#1C1C1E]">{p.name}</td>
                            <td className="px-5 py-2.5 text-[13px] text-[#6B7280]">{p.client}</td>
                            <td className="px-5 py-2.5 text-[13px] text-[#6B7280] text-right tabular-nums">{p.variations.length}</td>
                          </tr>
                        </Link>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 60/40 Split: Financial Health Chart + Urgent Feed ── */}
        <div className="flex flex-col md:flex-row gap-6">

          {/* Left 60%: Project Financial Health (already above, this is for desktop split context) */}
          {/* We re-use the section below as just the urgent feed for mobile, but on desktop we use grid */}

          {/* Right 40%: Urgent Attention Feed */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#1C1C1E]">
                ⚠️ Urgent Attention
                {urgentItems.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-[#DC2626] text-white text-[11px] font-bold rounded-full">
                    {urgentItems.length}
                  </span>
                )}
              </h2>
              {activeKpiFilter && (
                <span className="text-[11px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
                  Filtered: {summaries.find(s => s.status === activeKpiFilter)?.label}
                </span>
              )}
            </div>

            {urgentItems.length === 0 ? (
              <div className="bg-white rounded-md border border-[#E5E7EB] p-8 text-center">
                <div className="text-2xl mb-2">✅</div>
                <p className="text-[14px] text-[#6B7280]">No urgent items — all variations are on track.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {urgentItems.map(v => (
                  <Link key={v.id} href={`/variation/${v.id}`}>
                    <div className="bg-white rounded-md border border-[#E5E7EB] px-4 py-3 flex items-center justify-between hover:bg-[#F5F3EF] transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)] gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {/* Status Pill */}
                          {v.flagType === 'disputed' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEE2E2] text-[#DC2626]">
                              Disputed
                            </span>
                          )}
                          {(v.flagType === 'overdue' || v.flagType === 'highValue') && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3C7] text-[#92400E]">
                              {v.flagType === 'overdue' ? '⚠️ Overdue' : '⚠️ High Value'}
                            </span>
                          )}
                          <span className="text-[11px] text-[#9CA3AF]">{v.daysOld}d old</span>
                        </div>
                        <div className="text-[14px] font-medium text-[#1C1C1E] truncate">{v.title}</div>
                        <div className="text-[12px] text-[#6B7280] truncate mt-0.5">{v.project_name}</div>
                      </div>
                      {!isField && (
                        <div className="flex-shrink-0 text-right">
                          <div className="text-[14px] font-semibold tabular-nums text-[#1C1C1E]">{formatCurrency(v.estimated_value)}</div>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
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

      {/* Floating Action Button — Quick Capture (Blue) */}
      {!loading && (
        <Link
          href="/capture"
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-150"
          title="Quick Notice"
          aria-label="Quick Notice"
        >
          <span className="text-2xl font-light">+</span>
        </Link>
      )}
    </AppShell>
  );
}
