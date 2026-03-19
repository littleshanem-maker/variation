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

  // Hide FAB on detail pages that have their own sticky action bar
  const hideFab = /^\/(variation|notice)\/[^/]+$/.test(pathname);

  return (
    <>
      {/* FAB backdrop */}
      {!hideFab && fabOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* FAB action menu — floats above the FAB button */}
      {!hideFab && fabOpen && (
        <div className="fixed bottom-36 right-4 z-[60] flex flex-col items-end gap-3">
          <Link
            href="/notice/new"
            onClick={() => setFabOpen(false)}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-indigo-500 text-indigo-600 text-[15px] font-semibold rounded-2xl shadow-xl whitespace-nowrap"
          >
            <FileText size={16} />
            New Notice
          </Link>
          <Link
            href="/variation/new"
            onClick={() => setFabOpen(false)}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white text-[15px] font-semibold rounded-2xl shadow-xl whitespace-nowrap"
          >
            <Plus size={16} />
            New Request
          </Link>
        </div>
      )}

      {/* FAB button — hidden on detail pages that have their own action bar */}
      {!hideFab && <button
        onClick={() => setFabOpen(prev => !prev)}
        aria-label="Create new"
        className="fixed bottom-[76px] right-4 z-50 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform md:hidden"
      >
        {fabOpen
          ? <X size={24} strokeWidth={2.5} />
          : <Plus size={26} strokeWidth={2.5} />
        }
      </button>}

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-[#020617] border-t border-white/[0.08] flex items-stretch h-16 safe-area-inset-bottom">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-colors ${
                active ? 'text-white' : 'text-white/35 hover:text-white/60'
              }`}
            >
              {active && (
                <span className="sr-only">(current)</span>
              )}
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                {active && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500" />
                )}
              </div>
              <span className="text-[10px] font-medium tracking-wide leading-none">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setFeedbackOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-1 text-white/35 hover:text-white/60 transition-colors"
        >
          <MessageSquare size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-medium tracking-wide leading-none">Feedback</span>
        </button>
      </nav>
    </>
  );
}
