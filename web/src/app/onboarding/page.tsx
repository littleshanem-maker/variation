'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function OnboardingPage() {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 — Company
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — Project
  const [projectName, setProjectName] = useState('');
  const [projectClient, setProjectClient] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    loadCompany();
  }, []);

  async function loadCompany() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }

    const { data } = await supabase
      .from('company_members')
      .select('company_id, companies:company_id (id, name, address, phone)')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (data) {
      const company = data.companies as any;
      setCompanyId(company?.id ?? null);
      setCompanyName(company?.name === 'My Company' ? '' : (company?.name ?? ''));
      setCompanyAddress(company?.address ?? '');
      setCompanyPhone(company?.phone ?? '');
    }
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSaveAndNext() {
    if (!companyName.trim()) { setError('Company name is required.'); return; }
    if (!companyId) { setError('Company not found. Please refresh.'); return; }
    setSaving(true);
    setError(null);

    const supabase = createClient();

    // Upload logo if provided
    let logoUrl: string | null = null;
    if (logoFile) {
      const ext = logoFile.name.split('.').pop();
        const path = `${companyId}/logo.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('logos')
          .upload(path, logoFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
          logoUrl = urlData?.publicUrl ?? null;
        }
    }

    // Update company
    const updates: Record<string, string | null> = {
      name: companyName.trim(),
      address: companyAddress.trim() || null,
      phone: companyPhone.trim() || null,
    };
    if (logoUrl) updates.logo_url = logoUrl;

    const { error: updateErr } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', companyId);

    if (updateErr) {
      setError('Failed to save: ' + updateErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setStep(2);
  }

  async function handleCreateProject() {
    if (!projectName.trim()) { setProjectError('Project name is required.'); return; }
    if (!companyId) { setProjectError('Company not loaded. Please refresh.'); return; }
    setCreatingProject(true);
    setProjectError(null);

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setCreatingProject(false); return; }

    const newId = crypto.randomUUID();
    const { error: insertErr } = await supabase.from('projects').insert({
      id: newId,
      company_id: companyId,
      created_by: session.user.id,
      name: projectName.trim(),
      client: projectClient.trim() || null,
      is_active: true,
      notice_required: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertErr) {
      setProjectError('Failed to create project: ' + insertErr.message);
      setCreatingProject(false);
      return;
    }

    router.push(`/capture?project=${newId}&onboarding=true`);
  }

  const inputClass = "w-full px-3 py-2.5 text-[14px] border border-[#D8D2C4] rounded-md outline-none transition-all";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ backgroundColor: '#F5F2EA' }}>
      <div className="w-full max-w-md mx-auto">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} className="mb-4" />
          {step === 1 ? (
            <>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: '#4B5563' }}>Step 1 of 2</p>
              <h1 className="text-2xl font-medium tracking-tight text-center" style={{ color: '#111827' }}>
                Set up your company
              </h1>
              <p className="text-sm mt-1.5 text-center" style={{ color: '#334155' }}>
                This appears on all variation documents you send.
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: '#4B5563' }}>Step 2 of 2</p>
              <h1 className="text-2xl font-medium tracking-tight text-center" style={{ color: '#111827' }}>
                Your first project
              </h1>
              <p className="text-sm mt-1.5 text-center" style={{ color: '#334155' }}>
                Now let&apos;s set up a project so you can start capturing variations.
              </p>
            </>
          )}
        </div>

        {step === 1 ? (
          <>
            {/* Step 1 Form */}
            <div className="bg-[#FFFCF5] rounded-xl border shadow-sm p-6 space-y-5" style={{ borderColor: '#D8D2C4' }}>

              {error && (
                <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FBE6E4', border: '1px solid rgba(180,35,24,0.15)', color: '#B42318' }}>
                  {error}
                </div>
              )}

              {/* Company Name */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#4B5563' }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className={inputClass}
                  onFocus={e => { e.target.style.borderColor = '#17212B'; e.target.style.boxShadow = '0 0 0 3px rgba(23,33,43,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#D8D2C4'; e.target.style.boxShadow = 'none'; }}
                  placeholder="e.g. Company Pty Ltd"
                  autoFocus
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#4B5563' }}>
                  Business Address <span style={{ color: '#4B5563', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={companyAddress}
                  onChange={e => setCompanyAddress(e.target.value)}
                  className={inputClass + ' resize-none'}
                  onFocus={e => { e.target.style.borderColor = '#17212B'; e.target.style.boxShadow = '0 0 0 3px rgba(23,33,43,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#D8D2C4'; e.target.style.boxShadow = 'none'; }}
                  rows={2}
                  placeholder="e.g. 12 Smith St, Melbourne VIC 3000"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#4B5563' }}>
                  Phone <span style={{ color: '#4B5563', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="tel"
                  value={companyPhone}
                  onChange={e => setCompanyPhone(e.target.value)}
                  className={inputClass}
                  onFocus={e => { e.target.style.borderColor = '#17212B'; e.target.style.boxShadow = '0 0 0 3px rgba(23,33,43,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#D8D2C4'; e.target.style.boxShadow = 'none'; }}
                  placeholder="e.g. 03 9000 0000"
                />
              </div>

              {/* Logo */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#4B5563' }}>
                  Company Logo <span style={{ color: '#4B5563', fontWeight: 400 }}>(optional)</span>
                </label>
                {logoPreview ? (
                  <div className="flex items-center gap-3">
                    <img src={logoPreview} alt="Logo preview" className="h-14 w-auto rounded-md object-contain border" style={{ borderColor: '#D8D2C4' }} />
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="text-[13px]"
                      style={{ color: '#B42318' }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 border-2 border-dashed rounded-lg text-[13px] text-center transition-colors"
                    style={{ borderColor: '#D8D2C4', color: '#4B5563' }}
                    onMouseEnter={e => { (e.currentTarget).style.borderColor = '#17212B'; (e.currentTarget).style.color = '#17212B'; }}
                    onMouseLeave={e => { (e.currentTarget).style.borderColor = '#D8D2C4'; (e.currentTarget).style.color = '#4B5563'; }}
                  >
                    Click to upload logo (PNG or JPG)
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Step 1 Actions */}
            <div className="mt-4 space-y-2">
              <button
                onClick={handleSaveAndNext}
                disabled={saving || !companyName.trim()}
                className="w-full py-3 rounded-lg text-sm font-medium text-[#FFFCF5] bg-[#E76F00] hover:bg-[#C75A00] disabled:bg-[#D8D2C4] disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving…' : 'Next →'}
              </button>
              <button
                onClick={() => setStep(2)}
                className="w-full py-2.5 rounded-lg text-sm font-medium"
                style={{ color: '#334155', backgroundColor: 'transparent' }}
              >
                Skip for now
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2 Form */}
            <div className="bg-[#FFFCF5] rounded-xl border shadow-sm p-6 space-y-5" style={{ borderColor: '#D8D2C4' }}>

              {projectError && (
                <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FBE6E4', border: '1px solid rgba(180,35,24,0.15)', color: '#B42318' }}>
                  {projectError}
                </div>
              )}

              {/* Project Name */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#4B5563' }}>
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className={inputClass}
                  onFocus={e => { e.target.style.borderColor = '#17212B'; e.target.style.boxShadow = '0 0 0 3px rgba(23,33,43,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#D8D2C4'; e.target.style.boxShadow = 'none'; }}
                  placeholder="e.g. Austin Health — Level 6 Fitout"
                  autoFocus
                />
              </div>

              {/* Client */}
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#4B5563' }}>
                  Client / Head Contractor <span style={{ color: '#4B5563', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={projectClient}
                  onChange={e => setProjectClient(e.target.value)}
                  className={inputClass}
                  onFocus={e => { e.target.style.borderColor = '#17212B'; e.target.style.boxShadow = '0 0 0 3px rgba(23,33,43,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#D8D2C4'; e.target.style.boxShadow = 'none'; }}
                  placeholder="e.g. Multiplex"
                />
              </div>
            </div>

            {/* Step 2 Actions */}
            <div className="mt-4 space-y-2">
              <button
                onClick={handleCreateProject}
                disabled={creatingProject || !projectName.trim()}
                className="w-full py-3 rounded-lg text-sm font-medium text-[#FFFCF5] bg-[#E76F00] hover:bg-[#C75A00] disabled:bg-[#D8D2C4] disabled:cursor-not-allowed transition-colors"
              >
                {creatingProject ? 'Creating…' : 'Create project →'}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-2.5 rounded-lg text-sm font-medium"
                style={{ color: '#334155', backgroundColor: 'transparent' }}
              >
                Skip for now
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
