'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
    <div className="min-h-screen bg-[#1B365D] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white/10 rounded-md flex items-center justify-center text-white text-sm font-semibold">VC</div>
            <span className="text-xl font-semibold text-white tracking-tight">Variation Capture</span>
          </div>
          <p className="text-white/40 text-[13px]">Office Mode</p>
        </div>

        <div className="bg-white rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-7">
          <h2 className="text-[15px] font-semibold text-[#1C1C1E] mb-5">Sign in to your account</h2>

          {error && (
            <div className="mb-4 px-3 py-2.5 bg-[#B25B4E]/5 border border-[#B25B4E]/15 rounded text-[13px] text-[#B25B4E]">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#6B7280] uppercase tracking-[0.02em] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none transition-colors duration-[120ms]"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#6B7280] uppercase tracking-[0.02em] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none transition-colors duration-[120ms]"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-[#1B365D] text-white text-[14px] font-medium rounded-md hover:bg-[#24466F] disabled:opacity-50 transition-colors duration-[120ms] ease-out"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/25 text-[11px] mt-6">
          Pipeline Consulting Pty Ltd
        </p>
      </div>
    </div>
  );
}
