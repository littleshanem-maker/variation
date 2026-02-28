'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function TopBar({ title, onPrint, printLabel = 'Print' }: { title: string; onPrint?: () => void; printLabel?: string }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompany() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const name = user?.user_metadata?.company_name;
      if (name) setCompanyName(name);
    }
    loadCompany();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const displayTitle = companyName || title;

  return (
    <header className="h-12 md:h-14 border-b border-[#E5E7EB] bg-white flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-base md:text-lg font-semibold text-[#1C1C1E] truncate">{displayTitle}</h1>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onPrint && (
          <button
            onClick={onPrint}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-[#6B7280] bg-white border border-[#E5E7EB] rounded-md hover:bg-[#F5F3EF] transition-colors duration-[120ms] ease-out"
          >
            {printLabel}
          </button>
        )}
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-[13px] font-medium text-[#6B7280] bg-white border border-[#E5E7EB] rounded-md hover:bg-[#F5F3EF] hover:text-[#1C1C1E] transition-colors duration-[120ms] ease-out"
        >
          Log Out
        </button>
      </div>
    </header>
  );
}
