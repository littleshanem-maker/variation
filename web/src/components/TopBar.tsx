'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function TopBar({ title, onPrint, printLabel = 'Print' }: { title: string; onPrint?: () => void; printLabel?: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="h-14 border-b border-[#E5E7EB] bg-white flex items-center justify-between px-8">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 bg-[#1B365D] rounded-md flex items-center justify-center">
          <span className="text-white text-[10px] font-bold tracking-tight">LS</span>
        </div>
        <h1 className="text-lg font-semibold text-[#1C1C1E]">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {onPrint && (
        <button
          onClick={onPrint}
          className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-[#6B7280] bg-white border border-[#E5E7EB] rounded-md hover:bg-[#F5F3EF] transition-colors duration-[120ms] ease-out"
        >
          {printLabel}
        </button>
        )}
        <span className="px-2.5 py-1 text-[11px] font-semibold text-[#1B365D] bg-[#1B365D]/5 border border-[#1B365D]/10 rounded tracking-wide uppercase">
          Office
        </span>
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
