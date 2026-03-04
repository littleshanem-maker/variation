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
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [preferredStandard, setPreferredStandard] = useState<'AS4000' | 'AS2124' | 'both'>('both');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const router = useRouter();
  const { role, company, isAdmin, companyId, isLoading: roleLoading, refreshCompany } = useRole();

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
      setCompanyAddress(company.address || '');
      setCompanyPhone(company.phone || '');
      setPreferredStandard(company.preferred_standard || 'both');
      setLogoUrl(company.logo_url || null);
    }
  }, [company]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setLogoUploading(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const path = `${companyId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      alert('Logo upload failed: ' + uploadError.message);
      setLogoUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
    const { error: updateError } = await supabase.from('companies')
      .update({ logo_url: publicUrl }).eq('id', companyId);
    if (!updateError) {
      setLogoUrl(publicUrl);
      await refreshCompany();
    }
    setLogoUploading(false);
  }

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
      address: companyAddress.trim() || null,
      phone: companyPhone.trim() || null,
      preferred_standard: preferredStandard,
    }).eq('id', companyId);

    if (error) {
      console.error('Save company failed:', error);
      alert('Failed to save: ' + error.message);
    } else {
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 2000);
      await refreshCompany();
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
      <div className="p-4 md:p-8 max-w-lg space-y-6">

        {/* Account */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[16px] font-semibold text-[#1C1C1E] border-b border-[#F0F0EE] pb-3 mb-4">Account</h3>
          {email && (
            <div className="flex flex-col gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-medium text-[#1C1C1E] break-all">{email}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-block px-2.5 py-1 text-[12px] font-medium rounded-full capitalize ${roleBadgeColors[role] || ''}`}>
                    {role}
                  </span>
                  {company && <span className="text-[13px] text-[#6B7280] truncate">{company.name}</span>}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 px-3 text-[13px] font-medium text-[#B25B4E] bg-[#B25B4E]/5 border border-[#B25B4E]/15 rounded-md hover:bg-[#B25B4E]/10 transition-colors duration-[120ms] ease-out"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Company Settings — admin only */}
        {isAdmin && (
          <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="text-[16px] font-semibold text-[#1C1C1E] border-b border-[#F0F0EE] pb-3 mb-4">Company Settings</h3>
            <div className="space-y-4">

              {/* Logo */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-2">Company Logo</label>
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Company logo" className="h-14 w-14 object-contain rounded-md border border-[#E5E7EB] bg-white p-1" />
                  ) : (
                    <div className="h-14 w-14 rounded-md border border-dashed border-[#D1D5DB] flex items-center justify-center text-[#9CA3AF] text-xs text-center">No logo</div>
                  )}
                  <div>
                    <label className="cursor-pointer inline-block px-3 py-2 text-[13px] font-medium text-[#1B365D] bg-[#1B365D]/5 border border-[#1B365D]/20 rounded-md hover:bg-[#1B365D]/10 transition-colors">
                      {logoUploading ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
                    </label>
                    <p className="text-[11px] text-[#9CA3AF] mt-1">PNG, JPG or SVG · Appears on all printed documents</p>
                  </div>
                </div>
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2.5 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                />
              </div>

              {/* ABN */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5">ABN</label>
                <input
                  type="text"
                  value={companyAbn}
                  onChange={e => setCompanyAbn(e.target.value)}
                  className="w-full px-3 py-2.5 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                  placeholder="e.g. 12 345 678 901"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5">Address</label>
                <input
                  type="text"
                  value={companyAddress}
                  onChange={e => setCompanyAddress(e.target.value)}
                  className="w-full px-3 py-2.5 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                  placeholder="e.g. 123 Main St, Geelong VIC 3220"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5">Phone</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={e => setCompanyPhone(e.target.value)}
                  className="w-full px-3 py-2.5 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                  placeholder="e.g. 03 5222 0000"
                />
              </div>

              {/* Contract Standard */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF] mb-1.5">Contract Standard</label>
                <select
                  value={preferredStandard}
                  onChange={e => setPreferredStandard(e.target.value as any)}
                  className="w-full px-3 py-2.5 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none bg-white"
                >
                  <option value="both">AS 4000–1997 and AS 2124–1992 (both cited)</option>
                  <option value="AS4000">AS 4000–1997 only (Clause 36)</option>
                  <option value="AS2124">AS 2124–1992 only (Clause 40)</option>
                </select>
                <p className="text-[11px] text-[#9CA3AF] mt-1">Applied to the notice language on all printed Variation Requests and Notices</p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSaveCompany}
                  disabled={savingCompany || !companyName.trim()}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] disabled:opacity-40 transition-colors duration-[120ms]"
                >
                  {savingCompany ? 'Saving...' : 'Save'}
                </button>
                {companySaved && <span className="text-[13px] text-[#4A9D5B]">✓ Saved</span>}
              </div>
            </div>
          </div>
        )}

        {/* About */}
        <div className="bg-white rounded-md border border-[#E5E7EB] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[16px] font-semibold text-[#1C1C1E] border-b border-[#F0F0EE] pb-3 mb-4">About</h3>
          <p className="text-[14px] text-[#6B7280]">Variation Shield · <span className="capitalize">{role}</span> Access</p>
          <p className="text-[13px] text-[#9CA3AF] mt-1">Version 2.1.0 · Leveraged Systems</p>
        </div>

      </div>
    </AppShell>
  );
}
