'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import Logo from '@/components/Logo';

const STRIPE_CHECKOUT = 'https://buy.stripe.com/3cI00j9wN8ZQ1Gs90XfrW02';

function SignupContent() {
  const [mode, setMode] = useState<'choose' | 'form'>('choose');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('paid') === 'true') {
      setPaid(true);
      setMode('form');
    }
  }, [searchParams]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError('Please enter your full name.'); return; }
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
      p_company_name: 'My Company',
    });

    if (provisionError) {
      setError('Account created but setup failed: ' + provisionError.message);
      setLoading(false);
      return;
    }

    router.push('/onboarding');
    router.refresh();
  }

  const inputBase = {
    padding: '12px 16px',
    backgroundColor: '#FFFCF5',
    border: '1px solid #D8D2C4',
    color: '#111827',
    borderRadius: '8px',
    fontSize: '16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#F5F2EA' }}>
      <div className="w-full max-w-sm mx-auto px-6">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={64} className="mb-5" />
          <h1 className="text-2xl font-medium tracking-tight text-center" style={{ color: '#111827' }}>
            {mode === 'form' ? 'Create your account' : 'Get started'}
          </h1>
          <p className="text-sm mt-1.5 text-center" style={{ color: '#334155' }}>
            {mode === 'form' ? 'Start capturing variations in 60 seconds' : 'Choose how you want to get started'}
          </p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <a
              href={STRIPE_CHECKOUT}
              className="block w-full rounded-xl text-[#FFFCF5] text-sm font-medium text-center transition-colors"
              style={{ backgroundColor: '#E76F00', padding: '16px 20px' }}
            >
              <div className="text-base font-medium mb-0.5">Subscribe — $299/mo</div>
              <div className="text-xs font-normal" style={{ color: 'rgba(255,252,245,0.6)' }}>
                Early adopter rate · locked for 12 months · 30-day guarantee
              </div>
            </a>
          </div>
        )}

        {mode === 'form' && (
          <>
            {paid && (
              <div className="mb-5 px-4 py-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: '#E5F0E6', border: '1px solid rgba(46,125,50,0.2)', color: '#2E7D32' }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                Payment confirmed — create your account below
              </div>
            )}

            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FBE6E4', border: '1px solid rgba(180,35,24,0.15)', color: '#B42318' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  style={inputBase}
                  onFocus={e => { e.target.style.borderColor = '#17212B'; e.target.style.boxShadow = '0 0 0 3px rgba(23,33,43,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#D8D2C4'; e.target.style.boxShadow = 'none'; }}
                  placeholder="Full name"
                  required
                  autoFocus
                />
              </div>
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputBase}
                  onFocus={e => { e.target.style.borderColor = '#17212B'; e.target.style.boxShadow = '0 0 0 3px rgba(23,33,43,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#D8D2C4'; e.target.style.boxShadow = 'none'; }}
                  placeholder="Work email"
                  required
                />
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ ...inputBase, paddingRight: '48px' }}
                  onFocus={e => { e.target.style.borderColor = '#17212B'; e.target.style.boxShadow = '0 0 0 3px rgba(23,33,43,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#D8D2C4'; e.target.style.boxShadow = 'none'; }}
                  placeholder="Password (min. 6 characters)"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                  style={{ color: '#334155' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg text-sm font-medium text-[#FFFCF5] transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#17212B' }}
                onMouseEnter={e => { if (!loading) (e.target as HTMLElement).style.backgroundColor = '#334155'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = '#17212B'; }}
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>


          </>
        )}

        <p className="mt-6 text-center text-sm" style={{ color: '#334155' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-medium" style={{ color: '#17212B' }}>
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}
