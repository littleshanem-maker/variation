'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/lib/role';
import FeedbackModal from './FeedbackModal';
import {
  LayoutDashboard,
  ClipboardList,
  Settings,
  Plus,
  FileText,
  X,
  MessageSquare,
} from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { role } = useRole();
  const [fabOpen, setFabOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const tabs = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: [] },
    { label: 'Register', href: '/variations', icon: ClipboardList, roles: ['admin', 'office'] },
    { label: 'Notices',  href: '/notices',   icon: FileText,      roles: ['admin', 'office'] },
    { label: 'Settings', href: '/settings', icon: Settings, roles: [] },
  ].filter(t => t.roles.length === 0 || t.roles.includes(role));

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const hideFab = /^\/(variation|notice)\/[^/]+$/.test(pathname);
  const showFab = role !== 'field' && !hideFab;

  return (
    <>
      {showFab && fabOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#111827]/20"
          onClick={() => setFabOpen(false)}
        />
      )}

      {showFab && fabOpen && (
        <div className="fixed bottom-36 right-4 z-[60] flex flex-col items-end gap-3">
          <Link
            href="/notice/new"
            onClick={() => setFabOpen(false)}
            className="flex items-center gap-2 px-5 py-3 bg-[#FFFCF5] border border-[#D8D2C4] text-[#C75A00] text-[15px] font-medium shadow-[0_2px_6px_rgba(17,24,39,0.08)] whitespace-nowrap"
          >
            <FileText size={16} />
            New notice
          </Link>
          <Link
            href="/variation/new"
            onClick={() => setFabOpen(false)}
            className="flex items-center gap-2 px-5 py-3 bg-[#E76F00] border border-[#E76F00] text-[#FFFCF5] text-[15px] font-medium shadow-[0_2px_6px_rgba(17,24,39,0.12)] whitespace-nowrap"
          >
            <Plus size={16} />
            New request
          </Link>
        </div>
      )}

      {showFab && <button
        onClick={() => setFabOpen(prev => !prev)}
        aria-label="Create new"
        className="fixed bottom-[76px] right-4 z-50 w-14 h-14 rounded-full bg-[#E76F00] text-[#FFFCF5] shadow-xl flex items-center justify-center active:scale-95 transition-transform md:hidden"
      >
        {fabOpen
          ? <X size={24} strokeWidth={2.5} />
          : <Plus size={26} strokeWidth={2.5} />
        }
      </button>}

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-[#17212B] border-t border-[#FFFCF5]/[0.08] flex items-stretch h-16 safe-area-inset-bottom">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-colors ${
                active ? 'text-[#FFFCF5]' : 'text-[#FFFCF5]/35 hover:text-[#FFFCF5]/60'
              }`}
            >
              {active && (
                <span className="sr-only">(current)</span>
              )}
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {active && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#E76F00]" />
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setFeedbackOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-1 text-[#FFFCF5]/35 hover:text-[#FFFCF5]/60 transition-colors"
        >
          <MessageSquare size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-medium leading-none">Feedback</span>
        </button>
      </nav>
    </>
  );
}
