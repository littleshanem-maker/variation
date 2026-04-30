'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Read directly from DOM to handle browser autofill (which bypasses React onChange)
    const emailVal = emailRef.current?.value || email;
    const passwordVal = passwordRef.current?.value || password;

    const supabase = createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: emailVal, password: passwordVal });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Default every successful login to the dashboard.
    // Role lookups can fail under RLS, and falling back to field/capture is worse.
    window.location.replace('/dashboard');
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: '#F5F2EA' }}
    >
      <div className="w-full max-w-sm mx-auto px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Logo size={64} className="mb-5" />
          <h1 className="text-2xl font-medium tracking-tight" style={{ color: '#111827' }}>
            Welcome back
          </h1>
          <p className="text-sm mt-1.5" style={{ color: '#334155' }}>
            Sign in to Variation Shield
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-5 px-4 py-3 rounded-lg text-sm"
            style={{ backgroundColor: '#FBE6E4', border: '1px solid rgba(180,35,24,0.15)', color: '#B42318' }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg text-base outline-none transition-all"
              style={{
                padding: '12px 16px',
                backgroundColor: '#FFFCF5',
                border: '1px solid #D8D2C4',
                color: '#111827',
              }}
              onFocus={e => { e.target.style.borderColor = '#17212B'; e.target.style.boxShadow = '0 0 0 3px rgba(23,33,43,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = '#D8D2C4'; e.target.style.boxShadow = 'none'; }}
              placeholder="Work email"
              required
            />
          </div>
          <div className="relative">
            <input
              ref={passwordRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg text-base outline-none transition-all"
              style={{
                padding: '12px 44px 12px 16px',
                backgroundColor: '#FFFCF5',
                border: '1px solid #D8D2C4',
                color: '#111827',
              }}
              onFocus={e => { e.target.style.borderColor = '#17212B'; e.target.style.boxShadow = '0 0 0 3px rgba(23,33,43,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = '#D8D2C4'; e.target.style.boxShadow = 'none'; }}
              placeholder="Password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ right: '12px', color: '#4B5563', background: 'none', border: 'none', cursor: 'pointer' }}
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
            className="w-full rounded-lg text-base font-medium transition-all"
            style={{
              padding: '12px',
              backgroundColor: '#B84C00',
              color: '#FFFCF5',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              boxShadow: '0 1px 3px rgba(17,24,39,0.1)',
            }}
            onMouseEnter={e => { if (!loading) (e.target as HTMLElement).style.backgroundColor = '#9A3F00'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = '#B84C00'; }}
          >
            {loading ? 'Signing in...' : 'Log In'}
          </button>
        </form>

        <div className="text-center mt-5">
          <Link
            href="/forgot-password"
            className="text-sm font-medium transition-colors"
            style={{ color: '#17212B' }}
          >
            Forgot Password?
          </Link>
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: '#334155' }}>
          Don't have an account?{' '}
          <a href="https://buy.stripe.com/3cI00j9wN8ZQ1Gs90XfrW02" className="font-medium" style={{ color: '#17212B' }}>
            Sign up
          </a>
        </p>

        <p className="text-center text-xs mt-8" style={{ color: '#4B5563' }}>
          Leveraged Systems · Variation Shield
        </p>
      </div>
    </div>
  );
}
