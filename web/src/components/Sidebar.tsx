'use client';

import Link from 'next/link';
import Logo from './Logo';
import { usePathname } from 'next/navigation';
import { useRole } from '@/lib/role';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { UserRole } from '@/lib/types';
import {
  LayoutDashboard,
  ClipboardList,
  Archive,
  Users,
  Settings,
  Zap,
  Bell,
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
  { label: 'Dashboard',          href: '/',               icon: LayoutDashboard },
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

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      // Count variations currently in approved/disputed status changed by client via email
      supabase
        .from('status_changes')
        .select('variation_id', { count: 'exact', head: true })
        .in('to_status', ['approved', 'disputed'])
        .eq('changed_by', 'client-email')
        .then(({ count }) => setNotifCount(count ?? 0));
    });
  }, [pathname]);

  const visibleNav = nav.filter(item => !item.roles || item.roles.includes(role));

  return (
    <>

      {/* Sidebar panel */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] bg-[#020617] text-white flex-col z-50">
        {/* Logo */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <Logo size={32} />
            <span className="font-semibold text-[15px] tracking-tight">Variation Shield</span>
          </div>
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
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
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

        {/* Footer */}
        <div className="px-6 py-4">
          <div className="text-[11px] text-white/40 capitalize">{role} access</div>
        </div>
      </aside>
    </>
  );
}
