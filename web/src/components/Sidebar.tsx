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

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role, company } = useRole();

  const visibleNav = nav.filter(item => !item.roles || item.roles.includes(role));

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed left-0 top-0 bottom-0 w-[240px] bg-slate-900 text-white flex flex-col z-50
          transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <Image src="/variation-shield-logo.jpg" alt="Variation Shield" width={32} height={32} className="rounded-md object-cover" />
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
              onClick={onClose}
              className="flex items-center gap-2.5 px-3 py-2 rounded bg-[#D4A853] text-[#1B365D] text-[13px] font-semibold hover:bg-[#c49840] transition-colors"
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
                onClick={onClose}
                className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] transition-colors duration-[120ms] ease-out ${
                  active
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-white/50 hover:text-white/85 hover:bg-white/6 font-medium'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#D4A853] rounded-r" />
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
