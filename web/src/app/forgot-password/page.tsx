'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#F5F2EA' }}>
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="flex flex-col items-center mb-8">
          <Logo size={64} className="mb-5" />
          <h1 className="text-2xl font-medium tracking-tight" style={{ color: '#111827' }}>
            Reset your password
          </h1>
          <p className="text-sm mt-1.5 text-center" style={{ color: '#334155' }}>
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {sent ? (
          <div className="bg-[#FFFCF5] rounded-2xl p-6 shadow-sm text-center">
            <div className="text-3xl mb-3">📧</div>
            <h2 className="font-medium text-[#111827] mb-2">Check your email</h2>
            <p className="text-sm text-[#334155] mb-5">
              We've sent a password reset link to <strong>{email}</strong>. Check your inbox and click the link to reset your password.
            </p>
            <Link href="/login" className="text-sm font-medium" style={{ color: '#17212B' }}>
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[#FFFCF5] rounded-2xl p-6 shadow-sm space-y-4">
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm font-medium bg-[#FBE6E4] text-[#7A1810] border border-[#D8D2C4]">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#334155' }}>
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@yourcompany.com.au"
                className="w-full rounded-lg text-sm outline-none transition-all"
                style={{
                  padding: '12px 14px',
                  border: '1px solid #D8D2C4',
                  backgroundColor: '#FFFCF5',
                  color: '#111827',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-lg text-base font-medium transition-all"
              style={{
                padding: '12px',
                backgroundColor: '#E76F00',
                color: '#FFFCF5',
                border: 'none',
                cursor: loading || !email ? 'not-allowed' : 'pointer',
                opacity: loading || !email ? 0.5 : 1,
              }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div className="text-center">
              <Link href="/login" className="text-sm font-medium" style={{ color: '#334155' }}>
                ← Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
