'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-white"
    >
      {/* Top gradient band */}
      <div
        className="absolute top-0 left-0 right-0 h-64"
        style={{
          background: 'linear-gradient(180deg, #E2E8F0 0%, #EEF2F7 40%, rgba(255,255,255,0) 100%)',
        }}
      />

      {/* Subtle color accent in the gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-40 opacity-30"
        style={{
          background: 'linear-gradient(135deg, #CBD5E1 0%, #DDD6CC 50%, #C7D2E0 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-sm mx-auto px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/variation-shield-logo.jpg" alt="Variation Shield" width={64} height={64} className="rounded-xl mb-5 object-cover" />
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1C1C1E' }}>
            Welcome back
          </h1>
          <p className="text-sm mt-1.5" style={{ color: '#6B7280' }}>
            Sign in to Variation Shield
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-5 px-4 py-3 rounded-lg text-sm"
            style={{ backgroundColor: '#FDF2F0', border: '1px solid rgba(178,91,78,0.15)', color: '#B25B4E' }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg text-base outline-none transition-all"
              style={{
                padding: '12px 16px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                color: '#1C1C1E',
              }}
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
              className="w-full rounded-lg text-base outline-none transition-all"
              style={{
                padding: '12px 44px 12px 16px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                color: '#1C1C1E',
              }}
              onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 3px rgba(27,54,93,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
              placeholder="Password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ right: '12px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}
              tabIndex={-1}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {showPassword ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg text-base font-semibold transition-all"
            style={{
              padding: '12px',
              backgroundColor: '#1B365D',
              color: '#FFFFFF',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
            onMouseEnter={e => { if (!loading) (e.target as HTMLElement).style.backgroundColor = '#24466F'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = '#1B365D'; }}
          >
            {loading ? 'Signing in...' : 'Log In'}
          </button>
        </form>

        <div className="text-center mt-5">
          <a
            href="#"
            className="text-sm font-medium transition-colors"
            style={{ color: '#1B365D' }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = '#24466F'}
            onMouseLeave={e => (e.target as HTMLElement).style.color = '#1B365D'}
          >
            Forgot Password?
          </a>
        </div>

        <p className="text-center text-xs mt-10" style={{ color: '#C4C9D0' }}>
          Leveraged Systems · Leveraged Systems
        </p>
      </div>
    </div>
  );
}
