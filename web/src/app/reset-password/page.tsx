'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import Logo from '@/components/Logo';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Supabase injects the session via URL hash on redirect — detect it
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Session is ready — user can now set new password
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push('/dashboard'), 2500);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#EEF2F7' }}>
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="flex flex-col items-center mb-8">
          <Logo size={64} className="mb-5" />
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: '#1C1C1E' }}>
            Set new password
          </h1>
          <p className="text-sm mt-1.5" style={{ color: '#6B7280' }}>
            Choose a strong password for your account
          </p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="text-3xl mb-3">✅</div>
            <h2 className="font-semibold text-[#1C1C1E] mb-2">Password updated</h2>
            <p className="text-sm text-[#6B7280]">Redirecting you to the app...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                New password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full rounded-lg text-sm outline-none"
                style={{
                  padding: '12px 14px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#F9FAFB',
                  color: '#1C1C1E',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                Confirm new password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-lg text-sm outline-none"
                style={{
                  padding: '12px 14px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#F9FAFB',
                  color: '#1C1C1E',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full rounded-lg text-base font-semibold transition-all"
              style={{
                padding: '12px',
                backgroundColor: '#1B365D',
                color: '#FFFFFF',
                border: 'none',
                cursor: loading || !password || !confirm ? 'not-allowed' : 'pointer',
                opacity: loading || !password || !confirm ? 0.5 : 1,
              }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>

            <div className="text-center">
              <Link href="/login" className="text-sm font-medium" style={{ color: '#6B7280' }}>
                ← Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
