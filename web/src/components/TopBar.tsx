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
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="hidden md:flex h-14 border-b border-slate-200 bg-white items-center justify-between px-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2.5 min-w-0">
        <h1 className="text-[15px] font-semibold text-slate-900 truncate">{title}</h1>
        {companyName && (
          <span className="hidden lg:block text-[13px] text-slate-400 truncate">— {companyName}</span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Global creation CTAs */}
        <Link
          href="/notice/new"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-indigo-600 bg-white border border-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={15} strokeWidth={2.5} />
          New Notice
        </Link>
        <Link
          href="/variation/new"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={15} strokeWidth={2.5} />
          New Request
        </Link>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          Log Out
        </button>
      </div>
    </header>
  );
}
