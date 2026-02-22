'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase';

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      setEmail(session?.user?.email ?? null);
    }
    load();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <AppShell>
      <TopBar title="Settings" />
      <div className="p-8 max-w-2xl space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Account</h3>
          {email && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">{email}</div>
                <div className="text-xs text-gray-500 mt-0.5">Signed in via Supabase Auth</div>
              </div>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-2">About</h3>
          <p className="text-sm text-gray-500">Variation Capture — Office Mode</p>
          <p className="text-sm text-gray-500">Version 2.0.0 · Pipeline Consulting Pty Ltd</p>
        </div>
      </div>
    </AppShell>
  );
}
