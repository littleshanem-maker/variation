'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import Logo from '@/components/Logo';
import { CheckCircle2, Circle } from 'lucide-react';

const LS_KEY = 'vs_onboarding_done';

interface Step {
  id: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  { id: 'company', title: 'Name your company', description: 'Set your company name — it appears on all variation documents.' },
  { id: 'project', title: 'Create your first project', description: 'Add a project so you can start capturing variations against it.' },
  { id: 'capture', title: 'Capture your first variation', description: 'Try the 60-second capture flow on your phone or desktop.' },
];

export default function OnboardingPage() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [companyName, setCompanyName] = useState('');
  const [editingCompany, setEditingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Project modal
  const [showProject, setShowProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectClient, setProjectClient] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  const router = useRouter();

  // Load saved progress + company info
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try { setDone(JSON.parse(saved)); } catch {}
    }
    loadCompany();
  }, []);

  async function loadCompany() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('company_members')
      .select('company_id, companies:company_id (id, name)')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (data) {
      const company = data.companies as any;
      setCompanyId(company?.id ?? null);
      setCompanyName(company?.name ?? '');
      // If still placeholder, start in edit mode
      if (company?.name === 'My Company') setEditingCompany(true);
    }
  }

  function markDone(id: string) {
    const updated = { ...done, [id]: true };
    setDone(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  }

  async function handleSaveCompany() {
    if (!companyName.trim() || !companyId) return;
    setSavingCompany(true);
    const supabase = createClient();
    await supabase.from('companies').update({ name: companyName.trim() }).eq('id', companyId);
    setSavingCompany(false);
    setEditingCompany(false);
    markDone('company');
  }

  async function handleCreateProject() {
    if (!projectName.trim() || !projectClient.trim()) return;
    setCreatingProject(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !companyId) { setCreatingProject(false); return; }

    const { error } = await supabase.from('projects').insert({
      id: crypto.randomUUID(),
      created_by: session.user.id,
      company_id: companyId,
      name: projectName.trim(),
      client: projectClient.trim(),
      reference: '',
      is_active: true,
    });

    if (!error) {
      setShowProject(false);
      setProjectName('');
      setProjectClient('');
      markDone('project');
    }
    setCreatingProject(false);
  }

  const allDone = STEPS.every(s => done[s.id]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ backgroundColor: '#EEF2F7' }}>
      <div className="w-full max-w-md mx-auto">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} className="mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight text-center" style={{ color: '#1C1C1E' }}>
            Let's get you set up
          </h1>
          <p className="text-sm mt-1.5 text-center" style={{ color: '#6B7280' }}>
            Three quick steps and you're ready to capture variations.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3">

          {/* Step 1: Company name */}
          <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                {done['company']
                  ? <CheckCircle2 size={22} className="text-emerald-500" />
                  : <Circle size={22} style={{ color: '#D1D5DB' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold" style={{ color: '#1C1C1E' }}>Name your company</div>
                <div className="text-[13px] mt-0.5" style={{ color: '#6B7280' }}>It appears on all variation documents.</div>

                {!done['company'] && (
                  <div className="mt-3">
                    {editingCompany ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={companyName}
                          onChange={e => setCompanyName(e.target.value)}
                          className="flex-1 px-3 py-2 text-[14px] border rounded-md outline-none"
                          style={{ borderColor: '#E5E7EB', color: '#1C1C1E' }}
                          onFocus={e => e.target.style.borderColor = '#1B365D'}
                          onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                          placeholder="e.g. GEM Fire Service"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveCompany(); }}
                        />
                        <button
                          onClick={handleSaveCompany}
                          disabled={savingCompany || !companyName.trim()}
                          className="px-4 py-2 text-[13px] font-medium text-white rounded-md disabled:opacity-50"
                          style={{ backgroundColor: '#1B365D' }}
                        >
                          {savingCompany ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingCompany(true)}
                        className="text-[13px] font-medium"
                        style={{ color: '#1B365D' }}
                      >
                        {companyName ? `"${companyName}" — click to edit` : 'Set company name →'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: First project */}
          <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                {done['project']
                  ? <CheckCircle2 size={22} className="text-emerald-500" />
                  : <Circle size={22} style={{ color: '#D1D5DB' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold" style={{ color: '#1C1C1E' }}>Create your first project</div>
                <div className="text-[13px] mt-0.5" style={{ color: '#6B7280' }}>Add a project to capture variations against.</div>
                {!done['project'] && (
                  <button
                    onClick={() => setShowProject(true)}
                    className="mt-3 text-[13px] font-medium"
                    style={{ color: '#1B365D' }}
                  >
                    + New Project →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Capture */}
          <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0">
                {done['capture']
                  ? <CheckCircle2 size={22} className="text-emerald-500" />
                  : <Circle size={22} style={{ color: '#D1D5DB' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold" style={{ color: '#1C1C1E' }}>Capture your first variation</div>
                <div className="text-[13px] mt-0.5" style={{ color: '#6B7280' }}>Try the 60-second capture flow — works on mobile too.</div>
                {!done['capture'] && (
                  <Link
                    href="/capture"
                    onClick={() => markDone('capture')}
                    className="mt-3 inline-block text-[13px] font-medium"
                    style={{ color: '#1B365D' }}
                  >
                    Open capture →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6">
          {allDone ? (
            <Link
              href="/"
              className="flex items-center justify-center w-full py-3 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#1B365D' }}
            >
              You're all set — go to dashboard →
            </Link>
          ) : (
            <Link
              href="/"
              className="flex items-center justify-center w-full py-3 rounded-lg text-sm font-medium"
              style={{ color: '#6B7280', backgroundColor: '#F3F4F6' }}
            >
              Skip for now — go to dashboard
            </Link>
          )}
        </div>

      </div>

      {/* New Project Modal */}
      {showProject && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 px-0 sm:px-4" onClick={() => setShowProject(false)}>
          <div className="bg-white rounded-t-xl sm:rounded-xl border shadow-lg p-6 w-full sm:max-w-md" style={{ borderColor: '#E5E7EB' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold mb-4" style={{ color: '#1C1C1E' }}>New Project</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 text-[14px] border rounded-md outline-none"
                  style={{ borderColor: '#E5E7EB', color: '#1C1C1E' }}
                  onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 2px rgba(27,54,93,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                  placeholder="e.g. Northern Hospital — Mechanical"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Client</label>
                <input
                  type="text"
                  value={projectClient}
                  onChange={e => setProjectClient(e.target.value)}
                  className="w-full px-3 py-2 text-[14px] border rounded-md outline-none"
                  style={{ borderColor: '#E5E7EB', color: '#1C1C1E' }}
                  onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 2px rgba(27,54,93,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                  placeholder="e.g. Lendlease"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowProject(false)} className="px-3 py-1.5 text-[13px] font-medium" style={{ color: '#6B7280' }}>Cancel</button>
              <button
                onClick={handleCreateProject}
                disabled={creatingProject || !projectName.trim() || !projectClient.trim()}
                className="px-4 py-1.5 text-[13px] font-medium text-white rounded-md disabled:opacity-50"
                style={{ backgroundColor: '#1B365D' }}
              >
                {creatingProject ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
