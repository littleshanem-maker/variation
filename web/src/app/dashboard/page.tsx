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
  const [noVariationsBannerDismissed, setNoVariationsBannerDismissed] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [companyPlan, setCompanyPlan] = useState<'free' | 'pro' | null>(null);
  const [variationCount, setVariationCount] = useState(0);
  const [variationLimit, setVariationLimit] = useState<number | null>(null);

  // Global filters
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<DateRangeKey>('all');

  const { isField, companyId, isLoading: roleLoading, company } = useRole();

  // Do not auto-redirect from dashboard to field/capture.
  // If role lookup is stale or blocked by RLS, this would dump office/demo users into capture.

  useEffect(() => {
    if (!roleLoading) loadData();
  }, [roleLoading, companyId]);

  async function loadData() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.replace('/login'); return; }

    let projectsQuery = supabase
      .from('projects')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (companyId) projectsQuery = projectsQuery.eq('company_id', companyId);

    const { data: projectsData, error: pErr } = await projectsQuery;
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

    // Fetch company plan info from bootstrapped role context when possible.
    if (company) {
      setCompanyPlan(company.plan || 'free');
      setVariationCount(company.variation_count || 0);
      setVariationLimit(company.variation_limit ?? null);
    } else if (companyId) {
      const { data: compData } = await supabase
        .from('companies')
        .select('plan, variation_count, variation_limit')
        .eq('id', companyId)
        .single();
      if (compData) {
        setCompanyPlan(compData.plan || 'free');
        setVariationCount(compData.variation_count || 0);
        setVariationLimit(compData.variation_limit ?? null);
      }
    }

    // Check for first login onboarding
    const isFirstLogin = localStorage.getItem('vs_first_login') === '1';
    if (isFirstLogin) {
      localStorage.removeItem('vs_first_login');
    }

    setLoading(false);
  }

  async function handleCreateProject() {
    if (!newProjectName.trim() || !newProjectClient.trim()) return;
    if (!companyId) { alert('Company not loaded yet. Please refresh and try again.'); return; }
    setCreatingProject(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setCreatingProject(false); return; }

    // Free tier project limit check
    const { data: companyData } = await supabase
      .from('companies')
      .select('plan, project_limit')
      .eq('id', companyId)
      .single();
    if (companyData && companyData.plan === 'free' && companyData.project_limit !== null) {
      const activeProjects = projects.length;
      if (activeProjects >= companyData.project_limit) {
        alert(`Free plan allows ${companyData.project_limit} project. Upgrade to Pro for unlimited projects.`);
        setCreatingProject(false);
        return;
      }
    }

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
    id: string; name: string; client: string; totalValue: number;
    paid: number; submitted: number; disputed: number; other: number;
    variationCount: number;
  };

  const barChartData: ProjectBarData[] = useMemo(() => {
    return projects
      .filter(p => filterProject === 'all' || p.id === filterProject)
      .map(p => {
        const vars = filterByDateRange(
          p.variations,
          filterDateRange
        );
        const paid = vars.filter(v => ['paid', 'approved'].includes(v.status)).reduce((s, v) => s + (v.estimated_value || 0), 0);
        const submitted = vars.filter(v => v.status === 'submitted').reduce((s, v) => s + (v.estimated_value || 0), 0);
        const disputed = vars.filter(v => v.status === 'disputed').reduce((s, v) => s + (v.estimated_value || 0), 0);
        const other = vars.filter(v => ['draft', 'captured'].includes(v.status)).reduce((s, v) => s + (v.estimated_value || 0), 0);
        const totalValue = paid + submitted + disputed + other;
        return { id: p.id, name: p.name, client: p.client || '', totalValue, paid, submitted, disputed, other, variationCount: vars.length };
      })
      .sort((a, b) => b.totalValue - a.totalValue); // Sort by total bar length desc
  }, [projects, filterProject, filterDateRange]);

  // ── Urgent Attention Feed ─────────────────────────────────────────────────────
  type AlertKind = 'disputed' | 'overdue' | 'due-soon';
  type UrgentItem = {
    id: string; variationId: string; title: string; projectName: string;
    value: number; daysOld: number; kind: AlertKind; extra?: string;
  };

  const urgentItems: UrgentItem[] = useMemo(() => {
    const items: UrgentItem[] = [];
    const seen = new Set<string>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Disputed — group by project (always shown)
    const disputedByProject = new Map<string, { proj: Project & { variations: Variation[] }; vars: Variation[] }>();
    for (const v of filteredVariations.filter(v => v.status === 'disputed')) {
      const proj = projects.find(p => p.id === v.project_id);
      if (!proj) continue;
      if (!disputedByProject.has(proj.id)) disputedByProject.set(proj.id, { proj, vars: [] });
      disputedByProject.get(proj.id)!.vars.push(v);
      seen.add(v.id);
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

    // Due today or overdue (not approved/paid)
    for (const v of filteredVariations.filter(v => v.response_due_date && !['approved','paid'].includes(v.status))) {
      if (seen.has(v.id)) continue;
      const due = new Date(v.response_due_date! + 'T00:00:00');
      if (due <= today) {
        const proj = projects.find(p => p.id === v.project_id);
        const diffMs = today.getTime() - due.getTime();
        const daysOverdue = Math.round(diffMs / 86400000);
        items.push({
          id: `od-${v.id}`, variationId: v.id,
          title: v.title,
          projectName: proj?.name || 'Unknown',
          value: v.estimated_value || 0,
          daysOld: daysSince(v.captured_at),
          kind: daysOverdue === 0 ? 'due-soon' : 'overdue',
          extra: daysOverdue === 0 ? 'Due today' : `${daysOverdue} days overdue`,
        });
        seen.add(v.id);
      }
    }

    // Sort: overdue first, then due-soon, then disputed; within group by value desc
    const kindOrder: Record<string, number> = { overdue: 0, 'due-soon': 1, disputed: 2 };
    return items.sort((a, b) => {
      const kDiff = (kindOrder[a.kind] ?? 3) - (kindOrder[b.kind] ?? 3);
      if (kDiff !== 0) return kDiff;
      return b.value - a.value;
    });
  }, [filteredVariations, projects]);

  // ── Render guards ─────────────────────────────────────────────────────────────

  if (loading) return (
    <AppShell>
      <TopBar title="Executive risk overview" />
      <div className="flex items-center justify-center h-96">
        <div className="text-[#4B5563] text-sm">Loading...</div>
      </div>
    </AppShell>
  );

  if (error === 'not_authenticated') {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return <div className="min-h-screen flex items-center justify-center"><p className="text-[#4B5563] text-sm">Redirecting to login...</p></div>;
  }

  if (error) return (
    <AppShell>
      <TopBar title="Executive risk overview" />
      <div className="flex items-center justify-center h-96"><p className="text-[#B42318] text-sm">Error: {error}</p></div>
    </AppShell>
  );

  const maxBarValue = Math.max(...barChartData.map(p => p.totalValue), 1);

  return (
    <AppShell>
      <TopBar
        title="Executive risk overview"
      />

      <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">

        {/* ── Free Tier Onboarding Card ── */}
        {companyPlan === 'free' && projects.length === 0 && !onboardingDismissed && (
          <div className="bg-[#FBF1D6] border border-[#D8D2C4] rounded-xl p-6 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-medium text-[#111827]">Welcome. Let&apos;s capture your first variation.</h3>
                <p className="text-[#334155] text-sm mt-1">Start by creating a project, then log your first scope change.</p>
              </div>
              <button onClick={() => setOnboardingDismissed(true)} className="text-[#E76F00] hover:text-[#E76F00] text-xs">✕</button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button
                onClick={() => setShowNewProject(true)}
                className="flex items-center gap-2 bg-[#E76F00] border border-[#E76F00] hover:bg-[#C75A00] hover:border-[#C75A00] text-[#FFFCF5] text-sm font-medium px-4 py-2.5 rounded-lg transition-all hover:-translate-y-px"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                Create your first project
              </button>
            </div>
          </div>
        )}

        {/* ── Free Tier Usage Banner ── */}
        {companyPlan === 'free' && variationLimit !== null && variationCount > 0 && variationCount < variationLimit && (
          <div className={`rounded-lg px-4 py-3 text-sm flex items-center justify-between ${variationCount >= variationLimit - 1 ? 'bg-[#FBF1D6] border border-[#D8D2C4] text-[#8C6500]' : 'bg-[#FFFCF5] border border-[#D8D2C4] text-[#334155]'}`}>
            <span><span className="num">{variationCount}</span> of <span className="num">{variationLimit}</span> free variations used{variationCount >= variationLimit - 1 ? ' — last one.' : ''}</span>
            <a href="https://buy.stripe.com/3cI00j9wN8ZQ1Gs90XfrW02" className="font-medium underline ml-3 text-xs">Upgrade to pro</a>
          </div>
        )}

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
            className="h-9 px-3 text-[14px] border border-[#D8D2C4] rounded-md bg-[#FFFCF5] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#17212B] shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
          >
            <option value="all">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <select
            value={filterDateRange}
            onChange={e => setFilterDateRange(e.target.value as DateRangeKey)}
            className="h-9 px-3 text-[14px] border border-[#D8D2C4] rounded-md bg-[#FFFCF5] text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#17212B] shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
          >
            <option value="all">All time</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>

          <select
            disabled
            className="h-9 px-3 text-[14px] border border-[#D8D2C4] rounded-md bg-[#FFFCF5] text-[#4B5563] opacity-60 cursor-not-allowed shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
          >
            <option>All managers</option>
          </select>
        </div>

        {/* ── 3 KPI Cards ── */}
        {!isField && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Card 1: Cash Flow at Risk */}
            <Link href="/variations?status=at_risk">
              <div className="bg-[#FFFCF5] rounded-xl border border-[#D8D2C4] p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)] hover:shadow-[0_2px_4px_rgba(17,24,39,0.08)] transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <span className="lbl">Cash flow at risk</span>
                  <span className="cond inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#FBE6E4] text-[#7A1810]">
                    <span className="num">{atRiskVars.length}</span>&nbsp;unresolved
                  </span>
                </div>
                <div className="num text-[32px] font-medium leading-none text-[#B42318]">
                  {formatCurrency(atRiskTotal)}
                </div>
                <div className="mt-2 text-[12px] text-[#334155]">Disputed + draft + captured</div>
              </div>
            </Link>

            {/* Card 2: Pending Approval */}
            <Link href="/variations?status=submitted">
              <div className="bg-[#FFFCF5] rounded-xl border border-[#D8D2C4] p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)] hover:shadow-[0_2px_4px_rgba(17,24,39,0.08)] transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <span className="lbl">Pending approval</span>
                  {submittedVars.length > 0 && (
                    <span className="cond inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#FBF1D6] text-[#8C6500]">
                      <span className="num">{submittedVars.length}</span>&nbsp;submitted
                    </span>
                  )}
                </div>
                <div className="num text-[32px] font-medium leading-none text-[#C75A00]">
                  {formatCurrency(submittedTotal)}
                </div>
                <div className="mt-2 text-[12px] text-[#334155]">
                  {submittedVars.length > 0 ? <>Average <span className="num">{avgSubmittedDays}</span> days old</> : 'No pending variations'}
                </div>
              </div>
            </Link>

            {/* Card 3: Recovery Rate */}
            <div className="bg-[#FFFCF5] rounded-xl border border-[#D8D2C4] p-5 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
              <div className="flex items-start justify-between mb-4">
                <span className="lbl">Recovery rate</span>
                <span className="cond inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#E5F0E6] text-[#1F5223]">
                  <span className="num">{formatCurrency(paidTotal)}</span>&nbsp;paid
                </span>
              </div>
              <div className="flex items-baseline gap-2 leading-none">
                <span className="num text-[32px] font-medium text-[#111827]">{recoveryRate}%</span>
                <TrendingUp size={20} className="text-[#2E7D32] mb-0.5" strokeWidth={2.5} />
              </div>
              <div className="mt-2 text-[12px] text-[#334155]">
                of <span className="num">{formatCurrency(grandTotal)}</span> total variations
              </div>
            </div>

          </div>
        )}

        {/* ── Main Body: stacked ── */}
        <div className="flex flex-col gap-6">

          {/* Project Financial Health — full width */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="text-[18px] font-medium text-[#111827]">Project financial health</h2>
              <div className="flex items-center gap-2">
                {!isField && (
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-[#334155] bg-[#FFFCF5] border border-[#D8D2C4] rounded-md hover:bg-[#F5F2EA] transition-all hover:-translate-y-px shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
                  >
                    + New project
                  </button>
                )}
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="bg-[#FFFCF5] rounded-xl border border-[#D8D2C4] shadow-[0_1px_2px_rgba(17,24,39,0.04)] p-12 text-center">
                <div className="w-12 h-12 bg-[#E76F00] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFCF5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <h3 className="text-[18px] font-medium text-[#111827] mb-2">Welcome to Variation Shield</h3>
                <p className="text-[14px] text-[#334155] mb-1">Start by creating your first project.</p>
                <p className="text-[14px] text-[#334155] mb-8">Then capture a variation in under 60 seconds.</p>
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-[14px] font-medium text-[#FFFCF5] bg-[#E76F00] border border-[#E76F00] hover:bg-[#C75A00] hover:border-[#C75A00] transition-all hover:-translate-y-px"
                >
                  Create your first project
                </Link>
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
                        <div className="bg-[#FFFCF5] rounded-md border border-[#D8D2C4] px-4 py-3 flex items-center justify-between hover:bg-[#F5F2EA] transition-colors">
                          <div className="min-w-0 mr-3">
                            <div className="text-[14px] font-medium text-[#111827] truncate">{p.name}</div>
                            <div className="text-[12px] text-[#334155] truncate">{p.client}</div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="num text-[13px] font-medium text-[#111827]">{formatCurrency(totalVal)}</div>
                            {atRisk > 0 && <div className="text-[11px] text-[#B42318] font-medium"><span className="num">{formatCurrency(atRisk)}</span> at risk</div>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Desktop: stacked bar chart */}
                <div className="hidden md:block bg-[#FFFCF5] rounded-xl border border-[#D8D2C4] shadow-[0_1px_2px_rgba(17,24,39,0.04)] p-5 space-y-2">
                  {barChartData.length === 0 ? (
                    <p className="text-[13px] text-[#4B5563] text-center py-6">No variation data to display.</p>
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
                            <div className="min-w-0">
                            <Link
                              href={`/project/${p.id}`}
                              className="text-[14px] font-medium text-[#111827] hover:text-[#E76F00] transition-colors leading-tight"
                            >
                              {p.name}
                            </Link>
                            {p.client && <div className="text-[12px] text-[#334155] truncate">{p.client}</div>}
                            </div>
                            {!isField && (
                              <div className="flex-shrink-0 text-right">
                                <span className="num text-[13px] font-medium text-[#111827]">{formatCurrency(p.totalValue)}</span>
                                {p.disputed > 0 && (
                                  <span className="ml-2 text-[11px] text-[#B42318] font-medium"><span className="num">{formatCurrency(p.disputed)}</span> disputed</span>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Bar — segments are clickable links to filtered register */}
                          <div className="w-full h-[18px] bg-[#F5F2EA] rounded-md overflow-hidden mb-5 border border-[#D8D2C4]">
                            {p.variationCount === 0 ? (
                              <div className="flex items-center h-full px-2">
                                <span className="text-[11px] text-[#4B5563]">No variations yet — <Link href={`/project/${p.id}`} className="underline hover:text-[#17212B]">open project to add one</Link></span>
                              </div>
                            ) : p.totalValue === 0 ? (
                              <div className="flex items-center h-full px-2">
                                <span className="text-[11px] text-[#4B5563]">{p.variationCount} variation{p.variationCount !== 1 ? 's' : ''} — no value recorded yet</span>
                              </div>
                            ) : (
                              <div style={{ width: `${barW}%` }} className="flex h-full gap-px">
                                {paidPct > 0 && (
                                  <Link href={`/variations?status=approved&project=${p.id}`} style={{ width: `${paidPct}%` }}
                                    className="bg-[#2E7D32] h-full min-w-[2px] hover:brightness-110 transition-all cursor-pointer"
                                    title={`Paid / Approved: ${formatCurrency(p.paid)}`} />
                                )}
                                {subPct > 0 && (
                                  <Link href={`/variations?status=submitted&project=${p.id}`} style={{ width: `${subPct}%` }}
                                    className="bg-[#8C6500] h-full min-w-[2px] hover:brightness-110 transition-all cursor-pointer"
                                    title={`Submitted: ${formatCurrency(p.submitted)}`} />
                                )}
                                {dispPct > 0 && (
                                  <Link href={`/variations?status=disputed&project=${p.id}`} style={{ width: `${dispPct}%` }}
                                    className="bg-[#B42318] h-full min-w-[2px] hover:brightness-110 transition-all cursor-pointer"
                                    title={`Disputed: ${formatCurrency(p.disputed)}`} />
                                )}
                                {otherPct > 0 && (
                                  <Link href={`/variations?status=draft&project=${p.id}`} style={{ width: `${otherPct}%` }}
                                    className="bg-[#D8D2C4] h-full min-w-[2px] hover:brightness-110 transition-all cursor-pointer"
                                    title={`Draft: ${formatCurrency(p.other)}`} />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 pt-3 border-t border-[#D8D2C4]">
                    {[
                      { color: 'bg-[#2E7D32]', label: 'Paid / approved' },
                      { color: 'bg-[#8C6500]',  label: 'Submitted' },
                      { color: 'bg-[#B42318]',   label: 'Disputed' },
                      { color: 'bg-[#D8D2C4]',  label: 'Draft' },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${l.color}`} />
                        <span className="text-[12px] text-[#334155]">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* State B: projects exist but 0 variations — prompt to capture */}
          {projects.length > 0 && allVariationsRaw.length === 0 && !noVariationsBannerDismissed && (
            <div
              className="w-full px-4 py-3.5 rounded-lg flex items-center justify-between gap-3"
              style={{ backgroundColor: '#FFFCF5', border: '1px solid #D8D2C4', color: '#111827' }}
            >
              <div>
                <div className="text-[14px] font-medium mb-0.5">⚡ No variations yet.</div>
                <div className="text-[13px]" style={{ color: '#334155' }}>
                  Capture one now — it takes 60 seconds on site.{' '}
                  <Link href="/capture" className="underline font-medium hover:text-[#17212B]">Capture a variation</Link>
                </div>
              </div>
              <button
                onClick={() => setNoVariationsBannerDismissed(true)}
                className="flex-shrink-0 text-[18px] leading-none font-light"
                style={{ color: '#E76F00' }}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          {/* Urgent Attention Feed — full width, below bar chart */}
          <div className="w-full">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[18px] font-medium text-[#111827]">Urgent attention feed</h2>
              {urgentItems.length > 0 && (
                <span className="num inline-flex items-center justify-center w-5 h-5 bg-[#B42318] text-[#FFFCF5] text-[10px] font-medium rounded-full">
                  {urgentItems.length}
                </span>
              )}
            </div>

            <div className="bg-[#F5F2EA] rounded-xl border border-[#D8D2C4] p-2 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
              {urgentItems.length === 0 ? (
                <div className="bg-[#FFFCF5] rounded-lg p-8 text-center">
                  <div className="text-2xl mb-2">✅</div>
                  <p className="text-[13px] text-[#334155]">No urgent items — all variations on track.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {urgentItems.map(item => (
                    <Link key={item.id} href={`/variation/${item.variationId}?from=dashboard`}>
                      <div className="bg-[#FFFCF5] rounded-lg px-4 py-3.5 hover:bg-[#F5F2EA] transition-colors shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
                        <div className="flex items-start gap-3">
                          {/* Dot indicator */}
                          <div className={`flex-shrink-0 mt-1.5 w-2 h-2 rounded-full ${
                            item.kind === 'overdue' ? 'bg-[#B42318]' :
                            item.kind === 'disputed' ? 'bg-[#B42318]' : 'bg-[#8C6500]'
                          }`} />
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-[#111827] leading-snug">
                              <span className="font-medium">
                                {item.kind === 'overdue' ? 'Response overdue: '
                                  : item.kind === 'due-soon' ? 'Due soon: '
                                  : 'Dispute escalation: '}
                              </span>
                              {item.kind === 'overdue'
                                ? <>{item.projectName} — &quot;{item.title}&quot; response is <span className="num">{item.extra?.split(' ')[0]}</span> days overdue</>
                                : item.kind === 'due-soon'
                                ? `${item.projectName} — "${item.title}" — ${item.extra}`
                                : `${item.extra} at ${item.projectName} marked 'Disputed'`
                              }
                            </div>
                            <div className="mt-1.5">
                              {item.kind === 'overdue' ? (
                                <span className="cond inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-[#FBE6E4] text-[#7A1810]">
                                  Overdue
                                </span>
                              ) : item.kind === 'disputed' ? (
                                <span className="cond inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-[#FBE6E4] text-[#7A1810]">
                                  Disputed
                                </span>
                              ) : (
                                <span className="cond inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-[#FBF1D6] text-[#8C6500]">
                                  Due soon
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#111827]/20 px-0 sm:px-4" onClick={() => setShowNewProject(false)}>
            <div className="bg-[#FFFCF5] rounded-t-xl sm:rounded-md border border-[#D8D2C4] shadow-lg p-6 w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-[15px] font-medium text-[#111827] mb-4">New project</h3>
              <div className="space-y-3">
                <div>
                  <label className="cond block text-[11px] text-[#334155] mb-1">Project name</label>
                  <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                    className="w-full px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md focus:ring-1 focus:ring-[#17212B] focus:border-[#17212B] outline-none"
                    placeholder="e.g. Northern Hospital — Mechanical" autoFocus />
                </div>
                <div>
                  <label className="cond block text-[11px] text-[#334155] mb-1">Client</label>
                  <input type="text" value={newProjectClient} onChange={e => setNewProjectClient(e.target.value)}
                    className="w-full px-3 py-2 text-[14px] border border-[#D8D2C4] rounded-md focus:ring-1 focus:ring-[#17212B] focus:border-[#17212B] outline-none"
                    placeholder="e.g. Lendlease" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowNewProject(false)} className="px-3 py-1.5 text-[13px] font-medium text-[#334155] hover:text-[#111827] transition-colors">Cancel</button>
                <button onClick={handleCreateProject} disabled={creatingProject || !newProjectName.trim() || !newProjectClient.trim()}
                  className="px-4 py-1.5 text-[13px] font-medium text-[#FFFCF5] bg-[#17212B] rounded-md hover:bg-[#334155] disabled:opacity-40 transition-colors">
                  {creatingProject ? 'Creating...' : 'Create project'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>



    </AppShell>
  );
}
// Thu Mar  5 11:28:20 AEDT 2026
