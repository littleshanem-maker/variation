'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #E8EDF5 0%, #F1F5F9 30%, #FFFFFF 70%, #FFFFFF 100%)' }}
    >
      {/* Subtle decorative gradient band at top */}
      <div className="absolute top-0 left-0 right-0 h-48 opacity-40"
        style={{ background: 'linear-gradient(135deg, #C7D6EC 0%, #D4DCEB 30%, #E8D8CE 60%, #DFE8F0 100%)' }}
      />

      <div className="relative z-10 w-full max-w-[400px] px-6">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#1B365D] rounded-xl mb-5">
            <span className="text-white text-sm font-bold tracking-tight">VC</span>
          </div>
          <h1 className="text-[22px] font-semibold text-[#1C1C1E] tracking-tight">Welcome back</h1>
          <p className="text-[14px] text-[#6B7280] mt-1.5">Sign in to Variation Capture</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 bg-[#FDF2F0] border border-[#B25B4E]/15 rounded-lg text-[13px] text-[#B25B4E]">
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
              className="w-full px-4 py-3 text-[15px] bg-white border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1B365D]/20 focus:border-[#1B365D] outline-none transition-all duration-[150ms] placeholder:text-[#9CA3AF]"
              placeholder="Work email"
              required
            />
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-[15px] bg-white border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1B365D]/20 focus:border-[#1B365D] outline-none transition-all duration-[150ms] placeholder:text-[#9CA3AF] pr-11"
              placeholder="Password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
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
            className="w-full py-3 bg-[#1B365D] text-white text-[15px] font-semibold rounded-lg hover:bg-[#24466F] disabled:opacity-50 transition-all duration-[150ms] ease-out shadow-sm"
          >
            {loading ? 'Signing in...' : 'Log In'}
          </button>
        </form>

        <div className="text-center mt-5">
          <a href="#" className="text-[13px] text-[#1B365D] hover:text-[#24466F] font-medium transition-colors">
            Forgot Password?
          </a>
        </div>

        <p className="text-center text-[#C4C9D0] text-[11px] mt-10">
          Leveraged Systems · Pipeline Consulting Pty Ltd
        </p>
      </div>
    </div>
  );
}
