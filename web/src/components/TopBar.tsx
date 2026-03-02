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

  return (
    <header className="hidden md:flex h-14 border-b border-[#D1D5DB] bg-white items-center justify-between px-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2.5 min-w-0">
        <h1 className="text-[15px] font-bold text-[#0F172A] truncate">{title}</h1>
        {companyName && (
          <span className="hidden lg:block text-[13px] text-[#9CA3AF] truncate">— {companyName}</span>
        )}
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
