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
      <div className="p-8 max-w-lg space-y-5">
        <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Account</h3>
          {email && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-medium text-[#1C1C1E]">{email}</div>
                <div className="text-[12px] text-[#9CA3AF] mt-0.5">Supabase Auth</div>
              </div>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 text-[13px] font-medium text-[#B25B4E] bg-[#B25B4E]/5 border border-[#B25B4E]/15 rounded-md hover:bg-[#B25B4E]/10 transition-colors duration-[120ms] ease-out"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-2">About</h3>
          <p className="text-[13px] text-[#6B7280]">Variation Capture · Office Mode</p>
          <p className="text-[13px] text-[#9CA3AF] mt-0.5">Version 2.0.0 · Pipeline Consulting Pty Ltd</p>
        </div>
      </div>
    </AppShell>
  );
}
