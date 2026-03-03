'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { printRegister } from '@/lib/print';
import { useRole } from '@/lib/role';
import type { Project, Variation } from '@/lib/types';

type DateRangeKey = 'all' | 'week' | 'month' | '30d' | '90d';

function daysSince(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function filterByDateRange(variations: Variation[], range: DateRangeKey): Variation[] {
  if (range === 'all') return variations;
  const cutoffMs: Record<DateRangeKey, number> = {
    all: 0,
    week: 7 * 86400000,
    month: 30 * 86400000,
    '30d': 30 * 86400000,
    '90d': 90 * 86400000,
  };
  const cutoff = Date.now() - cutoffMs[range];
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
  const [filterDateRange, setFilterDateRange] = useState<DateRangeKey>('30d');

  const { isField, companyId } = useRole();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('not_authenticated'); setLoading(false); return; }

    const { data: projectsData, error: pErr } = await supabase
      .from('projects').select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (pErr) { setError(pErr.message); setLoading(false); return; }

    const { data: variationsData, error: vErr } = await supabase
      .from('variations').select('*').order('captured_at', { ascending: false });
    if (vErr) { setError(vErr.message); setLoading(false); return; }

    const activeProjectIds = new Set((projectsData || []).map((p: Project) => p.id));
    const allVariations = (variationsData || []).filter((v: Variation) => activeProjectIds.has(v.project_id));
    setAllVariationsRaw(allVariations);

    setProjects((projectsData || []).map((p: Project) => ({
      ...p,
      variations: allVariations.filter((v: Variation) => v.project_id === p.id),
    })));
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
    if (error) { alert('Failed to create project: ' + error.message); }
    else { setNewProjectName(''); setNewProjectClient(''); setShowNewProject(false); loadData(); }
    setCreatingProject(false);
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const filteredVariations = useMemo(() => {
    let vars = allVariationsRaw;
    if (filterProject !== 'all') vars = vars.filter(v => v.project_id === filterProject);
    return filterByDateRange(vars, filterDateRange);
  }, [allVariationsRaw, filterProject, filterDateRange]);

  // KPI 1 — Cash Flow at Risk (disputed + draft + captured)
  const atRiskVars = useMemo(() =>
    filteredVariations.filter(v => ['disputed', 'draft', 'captured'].includes(v.status)),
    [filteredVariations]);
  const atRiskTotal = atRiskVars.reduce((s, v) => s + (v.estimated_value || 0), 0);

  // KPI 2 — Pending Approval (submitted)
  const submittedVars = useMemo(() =>
    filteredVariations.filter(v => v.status === 'submitted'),
    [filteredVariations]);
  const submittedTotal = submittedVars.reduce((s, v) => s + (v.estimated_value || 0), 0);
  const avgSubmittedDays = submittedVars.length > 0
    ? Math.round(submittedVars.reduce((s, v) => s + daysSince(v.captured_at), 0) / submittedVars.length)
    : 0;

  // KPI 3 — Recovery Rate (paid / total * 100)
  const paidTotal = useMemo(() =>
    filteredVariations.filter(v => v.status === 'paid').reduce((s, v) => s + (v.estimated_value || 0), 0),
    [filteredVariations]);
  const grandTotal = filteredVariations.reduce((s, v) => s + (v.estimated_value || 0), 0);
  const recoveryRate = grandTotal > 0 ? Math.round((paidTotal / grandTotal) * 100) : 0;

  // ── Bar chart ─────────────────────────────────────────────────────────────────
  type ProjectBarData = {
    id: string; name: string; totalValue: number;
    paid: number; submitted: number; disputed: number; other: number;
  };

  const barChartData: ProjectBarData[] = useMemo(() => {
    return projects
      .map(p => {
        const vars = filterByDateRange(
          filterProject !== 'all' && p.id !== filterProject ? [] : p.variations,
          filterDateRange
        );
        const paid = vars.filter(v => ['paid', 'approved'].includes(v.status)).reduce((s, v) => s + (v.estimated_value || 0), 0);
        const submitted = vars.filter(v => v.status === 'submitted').reduce((s, v) => s + (v.estimated_value || 0), 0);
        const disputed = vars.filter(v => v.status === 'disputed').reduce((s, v) => s + (v.estimated_value || 0), 0);
        const other = vars.filter(v => ['draft', 'captured'].includes(v.status)).reduce((s, v) => s + (v.estimated_value || 0), 0);
        const totalValue = paid + submitted + disputed + other;
        return { id: p.id, name: p.name, totalValue, paid, submitted, disputed, other };
      })
      .filter(p => p.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue); // Sort by total bar length desc
  }, [projects, filterProject, filterDateRange]);

  // ── Urgent Attention Feed ─────────────────────────────────────────────────────
  type AlertKind = 'high-value' | 'disputed';
  type UrgentItem = {
    id: string; variationId: string; title: string; projectName: string;
    value: number; daysOld: number; kind: AlertKind; extra?: string;
  };

  const urgentItems: UrgentItem[] = useMemo(() => {
    const items: UrgentItem[] = [];

    // High-value submitted >7 days
    for (const v of submittedVars) {
      const daysOld = daysSince(v.captured_at);
      if (daysOld > 7 || (v.estimated_value || 0) > 1_000_000) {
        const proj = projects.find(p => p.id === v.project_id);
        items.push({
          id: `hv-${v.id}`, variationId: v.id,
          title: v.title,
          projectName: proj?.name || 'Unknown',
          value: v.estimated_value || 0,
          daysOld,
          kind: 'high-value',
          extra: daysOld > 7 ? `>10 days` : undefined,
        });
      }
    }

    // Disputed — group by project
    const disputedByProject = new Map<string, { proj: Project & { variations: Variation[] }; vars: Variation[] }>();
    for (const v of filteredVariations.filter(v => v.status === 'disputed')) {
      const proj = projects.find(p => p.id === v.project_id);
      if (!proj) continue;
      if (!disputedByProject.has(proj.id)) disputedByProject.set(proj.id, { proj, vars: [] });
      disputedByProject.get(proj.id)!.vars.push(v);
    }
    for (const [, { proj, vars }] of disputedByProject) {
      const totalDisputed = vars.reduce((s, v) => s + (v.estimated_value || 0), 0);
      items.push({
        id: `disp-${proj.id}`, variationId: vars[0].id,
        title: vars.length === 1 ? vars[0].title : `${vars.length} variations marked 'Disputed'`,
        projectName: proj.name,
        value: totalDisputed,
        daysOld: daysSince(vars[0].captured_at),
        kind: 'disputed',
        extra: `${vars.length} var${vars.length > 1 ? 's' : ''}`,
      });
    }

    // Sort: disputed first, then high-value by value desc
    return items.sort((a, b) => {
      if (a.kind === 'disputed' && b.kind !== 'disputed') return -1;
      if (b.kind === 'disputed' && a.kind !== 'disputed') return 1;
      return b.value - a.value;
    });
  }, [filteredVariations, submittedVars, projects]);

  // ── Render guards ─────────────────────────────────────────────────────────────

  if (loading) return (
    <AppShell>
      <TopBar title="Executive Risk Overview" />
      <div className="flex items-center justify-center h-96">
        <div className="text-[#9CA3AF] text-sm">Loading...</div>
      </div>
    </AppShell>
  );

  if (error === 'not_authenticated') {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return <div className="min-h-screen flex items-center justify-center"><p className="text-[#9CA3AF] text-sm">Redirecting to login...</p></div>;
  }

  if (error) return (
    <AppShell>
      <TopBar title="Executive Risk Overview" />
      <div className="flex items-center justify-center h-96"><p className="text-[#B25B4E] text-sm">Error: {error}</p></div>
    </AppShell>
  );

  const maxBarValue = Math.max(...barChartData.map(p => p.totalValue), 1);

  return (
    <AppShell>
      <TopBar
        title="Executive Risk Overview"
        onPrint={isField ? undefined : () => printRegister(projects)}
        printLabel="Print / Export"
      />

      <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
            className="px-3 py-1.5 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#374151] focus:outline-none focus:ring-1 focus:ring-[#1B365D] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
            disabled
            className="px-3 py-1.5 text-[13px] border border-[#E5E7EB] rounded-md bg-white text-[#9CA3AF] opacity-60 cursor-not-allowed shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <option>All Managers</option>
          </select>
        </div>

        {/* ── 3 KPI Cards ── */}
        {!isField && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Card 1: Cash Flow at Risk */}
            <Link href="/variations?status=at_risk">
              <div className="bg-white rounded-md border border-[#E5E7EB] border-l-4 border-l-[#DC2626] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07)] hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-semibold text-[#374151] uppercase tracking-wide">Cash Flow at Risk</span>
                  <span className="text-lg">⚠️</span>
                </div>
                <div className="text-[36px] font-black tabular-nums leading-none text-[#DC2626]">
                  {formatCurrency(atRiskTotal)}
                </div>
                <div className="mt-2 text-[12px] text-[#9CA3AF]">
                  {atRiskVars.length} var{atRiskVars.length !== 1 ? 's' : ''} unresolved
                </div>
              </div>
            </Link>

            {/* Card 2: Pending Approval */}
            <Link href="/variations?status=submitted">
              <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07)] hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-semibold text-[#374151] uppercase tracking-wide">Pending Approval</span>
                </div>
                <div className="text-[36px] font-black tabular-nums leading-none text-[#EAB308]">
                  {formatCurrency(submittedTotal)}
                </div>
                <div className="mt-2 text-[12px] text-[#9CA3AF]">
                  {submittedVars.length > 0 ? `Avg. ${avgSubmittedDays} days old` : 'No pending variations'}
                </div>
              </div>
            </Link>

            {/* Card 3: Recovery Rate */}
            <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-semibold text-[#374151] uppercase tracking-wide">Recovery Rate</span>
              </div>
              <div className="text-[36px] font-black tabular-nums leading-none text-[#1B365D]">
                {recoveryRate}% <span className="text-[28px]">↗</span>
              </div>
              <div className="mt-2 text-[12px] text-[#9CA3AF]">
                {formatCurrency(paidTotal)} of {formatCurrency(grandTotal)} paid
              </div>
            </div>

          </div>
        )}

        {/* ── Main Body: stacked ── */}
        <div className="flex flex-col gap-6">

          {/* Project Financial Health — full width */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-[#1C1C1E]">Project Financial Health (Visual)</h2>
              {!isField && (
                <button
                  onClick={() => setShowNewProject(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-[#6B7280] bg-white border border-[#E5E7EB] rounded-md hover:bg-[#F5F3EF] transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  + New Project
                </button>
              )}
            </div>

            {projects.length === 0 ? (
              <div className="bg-white rounded-md border border-[#E5E7EB] p-12 text-center text-[#9CA3AF] text-sm">
                No projects yet. Click <strong>+ New Project</strong> to get started.
              </div>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="md:hidden space-y-2">
                  {projects.map(p => {
                    const totalVal = p.variations.reduce((s, v) => s + (v.estimated_value || 0), 0);
                    const atRisk = p.variations.filter(v => ['disputed', 'draft', 'captured'].includes(v.status)).reduce((s, v) => s + (v.estimated_value || 0), 0);
                    return (
                      <Link key={p.id} href={`/project/${p.id}`}>
                        <div className="bg-white rounded-md border border-[#E5E7EB] px-4 py-3 flex items-center justify-between hover:bg-[#F5F3EF] transition-colors">
                          <div className="min-w-0 mr-3">
                            <div className="text-[14px] font-semibold text-[#1C1C1E] truncate">{p.name}</div>
                            <div className="text-[12px] text-[#6B7280] truncate">{p.client}</div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-[13px] font-semibold text-[#1C1C1E] tabular-nums">{formatCurrency(totalVal)}</div>
                            {atRisk > 0 && <div className="text-[11px] text-[#DC2626] font-medium tabular-nums">{formatCurrency(atRisk)} at risk</div>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Desktop: stacked bar chart */}
                <div className="hidden md:block bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 space-y-4">
                  {barChartData.length === 0 ? (
                    <p className="text-[13px] text-[#9CA3AF] text-center py-6">No variation data to display.</p>
                  ) : (
                    barChartData.map(p => {
                      const barW = (p.totalValue / maxBarValue) * 100;
                      const paidPct   = p.totalValue > 0 ? (p.paid      / p.totalValue) * 100 : 0;
                      const subPct    = p.totalValue > 0 ? (p.submitted / p.totalValue) * 100 : 0;
                      const dispPct   = p.totalValue > 0 ? (p.disputed  / p.totalValue) * 100 : 0;
                      const otherPct  = p.totalValue > 0 ? (p.other     / p.totalValue) * 100 : 0;
                      return (
                        <div key={p.id} className="space-y-1">
                          {/* Project name — full width, no truncation */}
                          <div className="flex items-baseline justify-between gap-4">
                            <Link
                              href={`/project/${p.id}`}
                              className="text-[13px] font-semibold text-[#1C1C1E] hover:text-[#1B365D] transition-colors leading-tight"
                            >
                              {p.name}
                            </Link>
                            {!isField && (
                              <div className="flex-shrink-0 text-right">
                                <span className="text-[13px] font-semibold text-[#1C1C1E] tabular-nums">{formatCurrency(p.totalValue)}</span>
                                {p.disputed > 0 && (
                                  <span className="ml-2 text-[11px] text-[#991B1B] font-medium tabular-nums">{formatCurrency(p.disputed)} disputed</span>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Bar — full width */}
                          <div className="w-full h-7 bg-[#F3F4F6] rounded overflow-hidden">
                            <div style={{ width: `${barW}%` }} className="flex h-full">
                              {paidPct > 0 && (
                                <div style={{ width: `${paidPct}%` }} className="bg-[#3B82F6] h-full"
                                  title={`Paid / Approved: ${formatCurrency(p.paid)}`} />
                              )}
                              {subPct > 0 && (
                                <div style={{ width: `${subPct}%` }} className="bg-[#EAB308] h-full"
                                  title={`Submitted: ${formatCurrency(p.submitted)}`} />
                              )}
                              {dispPct > 0 && (
                                <div style={{ width: `${dispPct}%` }} className="bg-[#991B1B] h-full"
                                  title={`Disputed: ${formatCurrency(p.disputed)}`} />
                              )}
                              {otherPct > 0 && (
                                <div style={{ width: `${otherPct}%` }} className="bg-[#D1D5DB] h-full"
                                  title={`Draft: ${formatCurrency(p.other)}`} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 pt-3 border-t border-[#F0F0EE]">
                    {[
                      { color: 'bg-[#3B82F6]', label: 'Paid / Approved' },
                      { color: 'bg-[#EAB308]', label: 'Submitted' },
                      { color: 'bg-[#991B1B]', label: 'Disputed' },
                      { color: 'bg-[#D1D5DB]', label: 'Draft' },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${l.color}`} />
                        <span className="text-[11px] text-[#6B7280]">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Urgent Attention Feed — full width, below bar chart */}
          <div className="w-full">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[16px] font-bold text-[#1C1C1E]">Urgent Attention Feed</h2>
              {urgentItems.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 bg-[#DC2626] text-white text-[10px] font-bold rounded-full">
                  {urgentItems.length}
                </span>
              )}
            </div>

            <div className="bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
              {urgentItems.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-2xl mb-2">✅</div>
                  <p className="text-[13px] text-[#6B7280]">No urgent items — all variations on track.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F0F0EE]">
                  {urgentItems.map(item => (
                    <Link key={item.id} href={`/variation/${item.variationId}`}>
                      <div className="px-4 py-3.5 hover:bg-[#FAFAFA] transition-colors">
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className="flex-shrink-0 mt-0.5 text-[18px]">
                            {item.kind === 'high-value' ? '⚠️' : '🔴'}
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-[#1C1C1E] leading-snug">
                              <span className="font-bold">
                                {item.kind === 'high-value' ? 'High Value Alert: ' : 'Dispute Escalation: '}
                              </span>
                              {item.kind === 'high-value'
                                ? `${item.projectName} variation (${formatCurrency(item.value)}) has been 'Submitted' for >${item.daysOld} days`
                                : `${item.extra} at ${item.projectName} marked 'Disputed'`
                              }
                            </div>
                            <div className="mt-2">
                              {item.kind === 'disputed' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DC2626] text-white uppercase tracking-wide">
                                  Disputed
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#92400E] uppercase tracking-wide">
                                  Submitted
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>{/* end 60/40 */}

        {/* ── New Project Modal ── */}
        {showNewProject && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowNewProject(false)}>
            <div className="bg-white rounded-t-xl sm:rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">New Project</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Project Name</label>
                  <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                    className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                    placeholder="e.g. Northern Hospital — Mechanical" autoFocus />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Client</label>
                  <input type="text" value={newProjectClient} onChange={e => setNewProjectClient(e.target.value)}
                    className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                    placeholder="e.g. Lendlease" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowNewProject(false)} className="px-3 py-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors">Cancel</button>
                <button onClick={handleCreateProject} disabled={creatingProject || !newProjectName.trim() || !newProjectClient.trim()}
                  className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] disabled:opacity-40 transition-colors">
                  {creatingProject ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── FAB: Blue ⚡ ── */}
      <Link
        href="/capture"
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-150"
        title="Quick Notice"
        aria-label="Quick Notice"
      >
        <span className="text-2xl">⚡</span>
      </Link>

    </AppShell>
  );
}
