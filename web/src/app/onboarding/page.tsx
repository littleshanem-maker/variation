'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function OnboardingPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  async function handleSave() {
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

    router.push('/');
  }

  const inputClass = "w-full px-3 py-2.5 text-[14px] border border-[#E5E7EB] rounded-md outline-none transition-all";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ backgroundColor: '#EEF2F7' }}>
      <div className="w-full max-w-md mx-auto">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={56} className="mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight text-center" style={{ color: '#1C1C1E' }}>
            Set up your company
          </h1>
          <p className="text-sm mt-1.5 text-center" style={{ color: '#6B7280' }}>
            This appears on all variation documents you send.
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5" style={{ borderColor: '#E5E7EB' }}>

          {error && (
            <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FDF2F0', border: '1px solid rgba(178,91,78,0.15)', color: '#B25B4E' }}>
              {error}
            </div>
          )}

          {/* Company Name */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9CA3AF' }}>
              Company Name *
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              className={inputClass}
              onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 3px rgba(27,54,93,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
              placeholder="e.g. GEM Fire Service Pty Ltd"
              autoFocus
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9CA3AF' }}>
              Business Address <span style={{ color: '#C4C9D0', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              value={companyAddress}
              onChange={e => setCompanyAddress(e.target.value)}
              className={inputClass + ' resize-none'}
              onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 3px rgba(27,54,93,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
              rows={2}
              placeholder="e.g. 12 Smith St, Melbourne VIC 3000"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9CA3AF' }}>
              Phone <span style={{ color: '#C4C9D0', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="tel"
              value={companyPhone}
              onChange={e => setCompanyPhone(e.target.value)}
              className={inputClass}
              onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 3px rgba(27,54,93,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
              placeholder="e.g. 03 9000 0000"
            />
          </div>

          {/* Logo */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9CA3AF' }}>
              Company Logo <span style={{ color: '#C4C9D0', fontWeight: 400 }}>(optional)</span>
            </label>
            {logoPreview ? (
              <div className="flex items-center gap-3">
                <img src={logoPreview} alt="Logo preview" className="h-14 w-auto rounded-md object-contain border" style={{ borderColor: '#E5E7EB' }} />
                <button
                  type="button"
                  onClick={() => { setLogoFile(null); setLogoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="text-[13px]"
                  style={{ color: '#B25B4E' }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 border-2 border-dashed rounded-lg text-[13px] text-center transition-colors"
                style={{ borderColor: '#E5E7EB', color: '#9CA3AF' }}
                onMouseEnter={e => { (e.currentTarget).style.borderColor = '#1B365D'; (e.currentTarget).style.color = '#1B365D'; }}
                onMouseLeave={e => { (e.currentTarget).style.borderColor = '#E5E7EB'; (e.currentTarget).style.color = '#9CA3AF'; }}
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

        {/* Actions */}
        <div className="mt-4 space-y-2">
          <button
            onClick={handleSave}
            disabled={saving || !companyName.trim()}
            className="w-full py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#1B365D' }}
            onMouseEnter={e => { if (!saving) (e.currentTarget).style.backgroundColor = '#24466F'; }}
            onMouseLeave={e => { (e.currentTarget).style.backgroundColor = '#1B365D'; }}
          >
            {saving ? 'Saving…' : 'Save & go to dashboard →'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full py-2.5 rounded-lg text-sm font-medium"
            style={{ color: '#6B7280', backgroundColor: 'transparent' }}
          >
            Skip for now
          </button>
        </div>

      </div>
    </div>
  );
}
