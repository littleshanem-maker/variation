'use client';

import { useEffect, useState, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
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

    // Deduplicate projects by ID (guards against duplicate rows from RLS/multi-company edge cases)
    const seenProjectIds = new Set<string>();
    const uniqueProjects = (projectsData || []).filter((p: Project) => {
      if (seenProjectIds.has(p.id)) return false;
      seenProjectIds.add(p.id);
      return true;
    });

    const activeProjectIds = new Set(uniqueProjects.map((p: Project) => p.id));
    const allVariations = (variationsData || []).filter((v: Variation) => activeProjectIds.has(v.project_id));
    setAllVariationsRaw(allVariations);

    setProjects(uniqueProjects.map((p: Project) => ({
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
  type AlertKind = 'high-value' | 'disputed' | 'overdue';
  type UrgentItem = {
    id: string; variationId: string; title: string; projectName: string;
    value: number; daysOld: number; kind: AlertKind; extra?: string;
  };

  const urgentItems: UrgentItem[] = useMemo(() => {
    const items: UrgentItem[] = [];
    const seen = new Set<string>();

    // Overdue — response_due_date has passed
    for (const v of filteredVariations.filter(v => v.response_due_date)) {
      const due = new Date(v.response_due_date! + 'T00:00:00');
      if (due < new Date() && !['approved','paid'].includes(v.status)) {
        const proj = projects.find(p => p.id === v.project_id);
        const daysOverdue = Math.ceil((Date.now() - due.getTime()) / 86400000);
        items.push({
          id: `od-${v.id}`, variationId: v.id,
          title: v.title,
          projectName: proj?.name || 'Unknown',
          value: v.estimated_value || 0,
          daysOld: daysSince(v.captured_at),
          kind: 'overdue',
          extra: `${daysOverdue}d overdue`,
        });
        seen.add(v.id);
      }
    }

    // High-value submitted >7 days
    for (const v of submittedVars) {
      if (seen.has(v.id)) continue;
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
        seen.add(v.id);
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

    // Sort: overdue first, then disputed, then high-value by value desc
    const kindOrder: Record<string, number> = { overdue: 0, disputed: 1, 'high-value': 2 };
    return items.sort((a, b) => {
      const kDiff = (kindOrder[a.kind] ?? 3) - (kindOrder[b.kind] ?? 3);
      if (kDiff !== 0) return kDiff;
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
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07)] hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Cash Flow at Risk</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600">
                    {atRiskVars.length} unresolved
                  </span>
                </div>
                <div className="text-[34px] font-black tabular-nums leading-none text-[#DC2626]">
                  {formatCurrency(atRiskTotal)}
                </div>
                <div className="mt-2 text-[12px] text-[#9CA3AF]">Disputed + draft + captured</div>
              </div>
            </Link>

            {/* Card 2: Pending Approval */}
            <Link href="/variations?status=submitted">
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07)] hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Pending Approval</span>
                  {submittedVars.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600">
                      {submittedVars.length} submitted
                    </span>
                  )}
                </div>
                <div className="text-[34px] font-black tabular-nums leading-none text-[#B45309]">
                  {formatCurrency(submittedTotal)}
                </div>
                <div className="mt-2 text-[12px] text-[#9CA3AF]">
                  {submittedVars.length > 0 ? `Avg. ${avgSubmittedDays} days old` : 'No pending variations'}
                </div>
              </div>
            </Link>

            {/* Card 3: Recovery Rate */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
              <div className="flex items-start justify-between mb-4">
                <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Recovery Rate</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                  {formatCurrency(paidTotal)} paid
                </span>
              </div>
              <div className="flex items-baseline gap-2 leading-none">
                <span className="text-[34px] font-black tabular-nums text-slate-900">{recoveryRate}%</span>
                <TrendingUp size={20} className="text-emerald-500 mb-0.5" strokeWidth={2.5} />
              </div>
              <div className="mt-2 text-[12px] text-[#9CA3AF]">
                of {formatCurrency(grandTotal)} total variations
              </div>
            </div>

          </div>
        )}

        {/* ── Main Body: stacked ── */}
        <div className="flex flex-col gap-6">

          {/* Project Financial Health — full width */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="text-[16px] font-bold text-[#1C1C1E]">Project Financial Health (Visual)</h2>
              <div className="flex items-center gap-2">
                {/* Quick Notice */}
                <Link
                  href="/capture"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-white bg-[#E85D1A] hover:bg-[#C94E14] rounded-md transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                >
                  ⚡ Quick Notice
                </Link>
                {/* Quick Request */}
                <Link
                  href="/variation/new"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-white bg-[#1B365D] hover:bg-[#24466F] rounded-md transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                >
                  + Quick Request
                </Link>
                {!isField && (
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-[#6B7280] bg-white border border-[#E5E7EB] rounded-md hover:bg-[#F5F3EF] transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    + New Project
                  </button>
                )}
              </div>
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
                <div className="hidden md:block bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 space-y-2">
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
                        <div key={p.id}>
                          {/* Name + value on the same row, immediately above bar */}
                          <div className="flex items-baseline justify-between gap-4 mb-1.5">
                            <Link
                              href={`/project/${p.id}`}
                              className="text-[13px] font-semibold text-[#1C1C1E] hover:text-indigo-600 transition-colors leading-tight"
                            >
                              {p.name}
                            </Link>
                            {!isField && (
                              <div className="flex-shrink-0 text-right">
                                <span className="text-[13px] font-semibold text-[#1C1C1E] tabular-nums">{formatCurrency(p.totalValue)}</span>
                                {p.disputed > 0 && (
                                  <span className="ml-2 text-[11px] text-rose-600 font-medium tabular-nums">{formatCurrency(p.disputed)} disputed</span>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Bar */}
                          <div className="w-full h-[18px] bg-slate-100 rounded-md overflow-hidden mb-5">
                            <div style={{ width: `${barW}%` }} className="flex h-full gap-px">
                              {paidPct > 0 && (
                                <div style={{ width: `${paidPct}%` }} className="bg-indigo-500 h-full min-w-[2px]"
                                  title={`Paid / Approved: ${formatCurrency(p.paid)}`} />
                              )}
                              {subPct > 0 && (
                                <div style={{ width: `${subPct}%` }} className="bg-amber-400 h-full min-w-[2px]"
                                  title={`Submitted: ${formatCurrency(p.submitted)}`} />
                              )}
                              {dispPct > 0 && (
                                <div style={{ width: `${dispPct}%` }} className="bg-rose-500 h-full min-w-[2px]"
                                  title={`Disputed: ${formatCurrency(p.disputed)}`} />
                              )}
                              {otherPct > 0 && (
                                <div style={{ width: `${otherPct}%` }} className="bg-slate-300 h-full min-w-[2px]"
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
                      { color: 'bg-indigo-500', label: 'Paid / Approved' },
                      { color: 'bg-amber-400',  label: 'Submitted' },
                      { color: 'bg-rose-500',   label: 'Disputed' },
                      { color: 'bg-slate-300',  label: 'Draft' },
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

            <div className="bg-slate-50 rounded-xl border border-[#E5E7EB] p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {urgentItems.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center">
                  <div className="text-2xl mb-2">✅</div>
                  <p className="text-[13px] text-[#6B7280]">No urgent items — all variations on track.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {urgentItems.map(item => (
                    <Link key={item.id} href={`/variation/${item.variationId}`}>
                      <div className="bg-white rounded-lg px-4 py-3.5 hover:bg-slate-50 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                        <div className="flex items-start gap-3">
                          {/* Dot indicator */}
                          <div className={`flex-shrink-0 mt-1.5 w-2 h-2 rounded-full ${
                            item.kind === 'overdue' ? 'bg-rose-500' :
                            item.kind === 'disputed' ? 'bg-rose-400' : 'bg-amber-400'
                          }`} />
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-[#1C1C1E] leading-snug">
                              <span className="font-semibold">
                                {item.kind === 'overdue' ? 'Response Overdue: '
                                  : item.kind === 'high-value' ? 'High Value Alert: '
                                  : 'Dispute Escalation: '}
                              </span>
                              {item.kind === 'overdue'
                                ? `${item.projectName} — "${item.title}" response is ${item.extra}`
                                : item.kind === 'high-value'
                                ? `${item.projectName} variation (${formatCurrency(item.value)}) has been 'Submitted' for >${item.daysOld} days`
                                : `${item.extra} at ${item.projectName} marked 'Disputed'`
                              }
                            </div>
                            <div className="mt-1.5">
                              {item.kind === 'overdue' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700">
                                  Overdue
                                </span>
                              ) : item.kind === 'disputed' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700">
                                  Disputed
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700">
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



    </AppShell>
  );
}
