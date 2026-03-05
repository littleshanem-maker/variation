'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/lib/role';
import type { UserRole } from '@/lib/types';
import {
  LayoutDashboard,
  ClipboardList,
  Archive,
  Users,
  Settings,
  Zap,
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
  { label: 'Dashboard',          href: '/',          icon: LayoutDashboard },
  { label: 'Variation Register', href: '/variations', icon: ClipboardList,  roles: ['admin', 'office'] },
  { label: 'Archived Projects',  href: '/archived',  icon: Archive,         roles: ['admin', 'office'] },
  { label: 'Team',               href: '/team',       icon: Users,           roles: ['admin'] },
  { label: 'Settings',           href: '/settings',  icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { role, company } = useRole();

  const visibleNav = nav.filter(item => !item.roles || item.roles.includes(role));

  return (
    <>

      {/* Sidebar panel */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] bg-[#020617] text-white flex-col z-50">
        {/* Logo */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <Image src="/variation-shield-logo.jpg" alt="Variation Shield" width={32} height={32} className="object-cover" />
            </div>
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
                
                className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] transition-colors duration-[120ms] ease-out ${
                  active
                    ? 'text-white font-semibold'
                    : 'text-white/40 hover:text-white/75 hover:bg-white/[0.04] font-medium'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-indigo-500 rounded-r" />
                )}
                <Icon
                  size={15}
                  strokeWidth={active ? 2.2 : 1.8}
                  className={active ? 'text-white' : 'text-white/50'}
                />
                {item.label}
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
