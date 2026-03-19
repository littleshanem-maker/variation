'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError('Please enter your full name.'); return; }
    setLoading(true);
    setError(null);

    const supabase = createClient();

    // Sign out any existing session first to avoid company cross-contamination
    await supabase.auth.signOut();

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
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

    // 2 & 3. Create company + membership via server-side RPC (bypasses RLS)
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

    // 4. Redirect to onboarding
    router.push('/onboarding');
    router.refresh();
  }

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#EEF2F7' }}>
      <div className="w-full max-w-sm mx-auto px-6">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={64} className="mb-5" />
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1C1C1E' }}>
            Create your account
          </h1>
          <p className="text-sm mt-1.5" style={{ color: '#6B7280' }}>
            Start capturing variations in 60 seconds
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FDF2F0', border: '1px solid rgba(178,91,78,0.15)', color: '#B25B4E' }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
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
          </div>
          <div>
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
          </div>
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
            style={{ backgroundColor: loading ? '#1B365D' : '#1B365D' }}
            onMouseEnter={e => { if (!loading) (e.target as HTMLElement).style.backgroundColor = '#24466F'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = '#1B365D'; }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        {/* Login link */}
        <p className="mt-6 text-center text-sm" style={{ color: '#6B7280' }}>
          Already have an account?{' '}
          <Link href="/login" className="font-medium" style={{ color: '#1B365D' }}>
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
}
