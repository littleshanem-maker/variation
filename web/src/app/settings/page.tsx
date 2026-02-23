'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase';
import { useRole } from '@/lib/role';

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyAbn, setCompanyAbn] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const router = useRouter();
  const { role, company, isAdmin, companyId } = useRole();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      setEmail(session?.user?.email ?? null);
    }
    load();
  }, []);

  useEffect(() => {
    if (company) {
      setCompanyName(company.name || '');
      setCompanyAbn(company.abn || '');
    }
  }, [company]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleSaveCompany() {
    if (!companyName.trim()) return;
    if (!companyId) { alert('Company not loaded yet. Please refresh and try again.'); return; }
    setSavingCompany(true);
    const supabase = createClient();
    const { error } = await supabase.from('companies').update({
      name: companyName.trim(),
      abn: companyAbn.trim() || null,
    }).eq('id', companyId);

    if (error) {
      console.error('Save company failed:', error);
      alert('Failed to save: ' + error.message);
    } else {
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 2000);
    }
    setSavingCompany(false);
  }

  const roleBadgeColors: Record<string, string> = {
    admin: 'bg-[#1B365D]/10 text-[#1B365D]',
    office: 'bg-[#D4A853]/10 text-[#96752A]',
    field: 'bg-[#E8713A]/10 text-[#B85A2B]',
  };

  return (
    <AppShell>
      <TopBar title="Settings" />
      <div className="p-8 max-w-lg space-y-5">
        <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Account</h3>
          {email && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-medium text-[#1C1C1E]">{email}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full capitalize ${roleBadgeColors[role] || ''}`}>
                    {role}
                  </span>
                  {company && <span className="text-[12px] text-[#9CA3AF]">{company.name}</span>}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 text-[13px] font-medium text-[#B25B4E] bg-[#B25B4E]/5 border border-[#B25B4E]/15 rounded-md hover:bg-[#B25B4E]/10 transition-colors duration-[120ms] ease-out"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Company Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">ABN</label>
                <input
                  type="text"
                  value={companyAbn}
                  onChange={e => setCompanyAbn(e.target.value)}
                  className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                  placeholder="e.g. 12 345 678 901"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveCompany}
                  disabled={savingCompany || !companyName.trim()}
                  className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] disabled:opacity-40 transition-colors duration-[120ms]"
                >
                  {savingCompany ? 'Saving...' : 'Save'}
                </button>
                {companySaved && <span className="text-[13px] text-[#4A9D5B]">✓ Saved</span>}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-2">About</h3>
          <p className="text-[13px] text-[#6B7280]">Variation Capture · <span className="capitalize">{role}</span> Access</p>
          <p className="text-[13px] text-[#9CA3AF] mt-0.5">Version 2.1.0 · Pipeline Consulting Pty Ltd</p>
        </div>
      </div>
    </AppShell>
  );
}
