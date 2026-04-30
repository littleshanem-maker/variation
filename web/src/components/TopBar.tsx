'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Plus } from 'lucide-react';
import { useRole } from '@/lib/role';

export default function TopBar({ title }: { title: string }) {
  const router = useRouter();
  const { company } = useRole();
  const companyName = company?.name ?? null;
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.replace('/login');
  }

  return (
    <header className="hidden md:flex h-14 border-b border-[#D8D2C4] bg-[#FFFCF5] items-center justify-between px-8 shadow-[0_1px_2px_rgba(17,24,39,0.04)]">
      <div className="flex items-center gap-2.5 min-w-0">
        <h1 className="text-[15px] font-medium text-[#111827] truncate">{title}</h1>
        {companyName && (
          <span className="hidden lg:block text-[13px] text-[#334155] truncate">— {companyName}</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/notice/new"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#C75A00] bg-[#FFFCF5] border border-[#D8D2C4] hover:border-[#C75A00] hover:-translate-y-px transition-all shadow-[0_1px_2px_rgba(17,24,39,0.04)]"
        >
          <Plus size={15} strokeWidth={2.5} />
          New notice
        </Link>
        <Link
          href="/variation/new"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-white bg-[#E76F00] border border-[#E76F00] hover:bg-[#C75A00] hover:border-[#C75A00] hover:-translate-y-px transition-all shadow-[0_1px_2px_rgba(17,24,39,0.08)]"
        >
          <Plus size={15} strokeWidth={2.5} />
          New request
        </Link>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-[13px] font-medium text-[#334155] bg-[#FFFCF5] border border-[#D8D2C4] hover:text-[#111827] hover:-translate-y-px transition-all"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
