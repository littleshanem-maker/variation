'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import Logo from '@/components/Logo';
import type { Metadata } from 'next';
import { getStripeCheckoutUrl } from '@/lib/links';

const inputBase = {
  padding: '12px 16px',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  color: '#1C1C1E',
  borderRadius: '8px',
  fontSize: '16px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

function FreeSignupContent() {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError('Please enter your full name.'); return; }
    if (!companyName.trim()) { setError('Please enter your company name.'); return; }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    await supabase.auth.signOut();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setError('Signup failed — please try again.');
      setLoading(false);
      return;
    }

    const companyId = crypto.randomUUID();
    const { error: provisionError } = await supabase.rpc('provision_new_account', {
      p_company_id: companyId,
      p_company_name: companyName.trim(),
    });

    if (provisionError) {
      setError('Account created but setup failed: ' + provisionError.message);
      setLoading(false);
      return;
    }

    // Mark as first login for onboarding
    localStorage.setItem('vs_first_login', '1');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#EEF2F7' }}>
      <div className="w-full max-w-sm mx-auto px-6">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={64} className="mb-5" />
          <h1 className="text-2xl font-semibold tracking-tight text-center" style={{ color: '#1C1C1E' }}>
            Start for free
          </h1>
          <p className="text-sm mt-1.5 text-center" style={{ color: '#6B7280' }}>
            No credit card required · 3 free variations
          </p>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FDF2F0', border: '1px solid rgba(178,91,78,0.15)', color: '#B25B4E' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            style={inputBase}
            onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 3px rgba(27,54,93,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
            placeholder="Full name"
            required
            autoFocus
          />
          <input
            type="text"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            style={inputBase}
            onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 3px rgba(27,54,93,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
            placeholder="Company name"
            required
          />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputBase}
            onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 3px rgba(27,54,93,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
            placeholder="Work email"
            required
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ ...inputBase, paddingRight: '48px' }}
              onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 3px rgba(27,54,93,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
              placeholder="Password (min. 6 characters)"
              minLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
              style={{ color: '#6B7280' }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#4f46e5' }}
          >
            {loading ? 'Creating account…' : 'Create free account'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs" style={{ color: '#9CA3AF' }}>
          Free plan: 1 project · 3 variations · no credit card
        </p>

        <p className="mt-6 text-center text-sm" style={{ color: '#6B7280' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-medium" style={{ color: '#1B365D' }}>
            Sign in
          </Link>
        </p>

        <p className="mt-3 text-center text-sm" style={{ color: '#6B7280' }}>
          Ready to go Pro?{' '}
          <a href={getStripeCheckoutUrl()} className="font-medium" style={{ color: '#4f46e5' }}>
            Subscribe — $299/mo
          </a>
        </p>
      </div>
    </div>
  );
}

export default function FreeSignupPage() {
  return (
    <Suspense>
      <FreeSignupContent />
    </Suspense>
  );
}
