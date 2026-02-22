'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import StatusBadge from '@/components/StatusBadge';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, getStatusConfig } from '@/lib/utils';
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

    // Load projects
    const { data: projectsData, error: pErr } = await supabase
      .from('projects')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (pErr) { setError(pErr.message); setLoading(false); return; }

    // Load all variations
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

    // Recent variations with project name
    const recent = allVariations.slice(0, 10).map((v: Variation) => {
      const proj = (projectsData || []).find((p: Project) => p.id === v.project_id);
      return { ...v, project_name: proj?.name || 'Unknown' };
    });
    setRecentVariations(recent);
    setLoading(false);
  }

  if (loading) {
    return (
      <AppShell>
        <TopBar title="Variation Register" />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-400 text-lg">Loading...</div>
        </div>
      </AppShell>
    );
  }

  if (error === 'not_authenticated') {
    return (
      <AppShell>
        <TopBar title="Variation Register" />
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <p className="text-gray-500">You need to sign in to view your data.</p>
          <Link href="/login" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Sign In
          </Link>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <TopBar title="Variation Register" />
        <div className="flex items-center justify-center h-96">
          <p className="text-red-500">Error: {error}</p>
        </div>
      </AppShell>
    );
  }

  // Calculate status summaries
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

  // At Risk = disputed + captured
  const atRiskVariations = allVariations.filter(v => v.status === 'disputed' || v.status === 'captured');
  summaries.push({
    status: 'at_risk',
    label: 'At Risk',
    count: atRiskVariations.length,
    total: atRiskVariations.reduce((sum, v) => sum + v.estimated_value, 0),
    border: 'border-orange-500',
  });

  return (
    <AppShell>
      <TopBar title="Variation Register" />
      <div className="p-8 space-y-8">
        {/* Status Summary Boxes */}
        <div className="grid grid-cols-6 gap-4">
          {summaries.map(s => (
            <div key={s.status} className={`bg-white rounded-xl border-t-4 ${s.border} border border-gray-200 p-5 shadow-sm`}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{s.label}</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(s.total)}</div>
              <div className="text-sm text-gray-500 mt-1">
                {s.count} {s.count === 1 ? 'variation' : 'variations'}
              </div>
              <button className="text-xs text-blue-600 hover:text-blue-800 mt-2 font-medium">
                View details →
              </button>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              + New Project
            </button>
          </div>
          {projects.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              No projects yet. Create one from the mobile app or click + New Project.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {projects.map(p => {
                const totalValue = p.variations.reduce((sum, v) => sum + v.estimated_value, 0);
                const atRisk = p.variations
                  .filter(v => v.status === 'disputed' || v.status === 'captured')
                  .reduce((sum, v) => sum + v.estimated_value, 0);
                return (
                  <Link
                    key={p.id}
                    href={`/project/${p.id}`}
                    className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all group"
                  >
                    <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{p.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{p.client}</div>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm text-gray-500">{p.variations.length} variations</span>
                      <span className="text-lg font-bold text-gray-900">{formatCurrency(totalValue)}</span>
                    </div>
                    {atRisk > 0 && (
                      <div className="mt-3 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700 font-medium">
                        ⚠ At Risk: {formatCurrency(atRisk)}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <span className="text-sm text-blue-600 font-medium">Last 10 variations</span>
          </div>
          {recentVariations.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              No variations captured yet.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Title</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Project</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Value</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVariations.map(v => (
                    <Link key={v.id} href={`/variation/${v.id}`} className="contents">
                      <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{v.title}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{v.project_name}</td>
                        <td className="px-6 py-4"><StatusBadge status={v.status} /></td>
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
      </div>
    </AppShell>
  );
}
