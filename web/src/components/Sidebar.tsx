'use client';

import Link from 'next/link';
import Logo from './Logo';
import { usePathname } from 'next/navigation';
import { useRole } from '@/lib/role';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { UserRole } from '@/lib/types';
import FeedbackModal from './FeedbackModal';
import {
  LayoutDashboard,
  ClipboardList,
  Archive,
  Users,
  Settings,
  Zap,
  Bell,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
  highlight?: boolean;
}

const nav: NavItem[] = [
  { label: 'Dashboard',          href: '/dashboard',      icon: LayoutDashboard },
  { label: 'Variation Register', href: '/variations',     icon: ClipboardList,  roles: ['admin', 'office'] },
  { label: 'Archived Projects',  href: '/archived',       icon: Archive,        roles: ['admin', 'office'] },
  { label: 'Team',               href: '/team',           icon: Users,          roles: ['admin'] },
  { label: 'Notifications',      href: '/notifications',  icon: Bell,           roles: ['admin', 'office'] },
  { label: 'Settings',           href: '/settings',       icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { role, company } = useRole();
  const [notifCount, setNotifCount] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      // Count unseen client responses (exclude IDs stored in localStorage)
      supabase
        .from('variations')
        .select('id')
        .in('client_approval_response', ['approved', 'rejected'])
        .then(({ data }) => {
          if (!data) return;
          try {
            const seen = new Set(JSON.parse(localStorage.getItem('vs_seen_notifications') || '[]'));
            setNotifCount(data.filter((v: any) => !seen.has(v.id)).length);
          } catch { setNotifCount(data.length); }
        });
    });
  }, [pathname]);

  const visibleNav = nav.filter(item => !item.roles || item.roles.includes(role));

  return (
    <>

      {/* Sidebar panel */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] bg-[#020617] text-white flex-col z-50">
        {/* Logo */}
        <div className="px-6 py-6">
          <a href="https://variationshield.com.au" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Logo size={32} />
            <span className="font-semibold text-[15px] tracking-tight">Variation Shield</span>
          </a>
          {company && (
            <div className="mt-2 text-[11px] text-white/40 truncate">{company.name}</div>
          )}
        </div>

        {/* Quick Capture shortcut (field-visible) */}
        {role === 'field' && (
          <div className="px-3 pb-2">
            <Link
              href="/capture"
              
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 transition-colors"
            >
              <Zap size={15} strokeWidth={2.5} />
              Quick Capture
            </Link>

          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 pt-1 space-y-0.5">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-md text-[13px] transition-colors duration-[120ms] ease-out ${
                  active
                    ? 'text-white font-semibold'
                    : 'text-white/40 hover:text-white/75 hover:bg-white/[0.04] font-medium'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-indigo-500 rounded-r" />
                  )}
                  <Icon
                    size={15}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={active ? 'text-white' : 'text-white/50'}
                  />
                  {item.label}
                </div>
                {item.href === '/notifications' && notifCount > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-rose-500 text-white rounded-full">
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Trial countdown */}
        {company?.created_at && (() => {
          const trialEnd = new Date(company.created_at);
          trialEnd.setDate(trialEnd.getDate() + 30);
          const daysLeft = Math.ceil((trialEnd.getTime() - Date.now()) / 86400000);
          const isExpiring = daysLeft <= 7;
          const isExpired = daysLeft <= 0;
          if (isExpired) return (
            <div className="mx-4 mb-3 px-3 py-2.5 rounded-lg bg-rose-900/30 border border-rose-700/40">
              <div className="text-[11px] font-semibold text-rose-400">Trial expired</div>
              <div className="text-[10px] text-rose-400/70 mt-0.5">Contact us to continue</div>
            </div>
          );
          return (
            <div className={`mx-4 mb-3 px-3 py-2.5 rounded-lg ${isExpiring ? 'bg-amber-900/30 border border-amber-700/40' : 'bg-white/[0.04] border border-white/[0.06]'}`}>
              <div className={`text-[11px] font-semibold ${isExpiring ? 'text-amber-400' : 'text-white/50'}`}>
                {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in trial
              </div>
              <div className={`text-[10px] mt-0.5 ${isExpiring ? 'text-amber-400/70' : 'text-white/30'}`}>30-day free trial</div>
            </div>
          );
        })()}
        {/* Footer */}
        <div className="px-3 py-4 space-y-1">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-white/40 hover:text-white/75 hover:bg-white/[0.04] transition-colors"
          >
            <MessageSquare size={15} strokeWidth={1.8} className="text-white/50" />
            Feedback
          </button>
          <div className="px-3 pt-1">
            <div className="text-[11px] text-white/25 capitalize">{role} access</div>
          </div>
        </div>
      </aside>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
