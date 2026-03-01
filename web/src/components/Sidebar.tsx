'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/lib/role';
import type { UserRole } from '@/lib/types';

interface NavItem {
  label: string;
  href: string;
  roles?: UserRole[]; // if undefined, visible to all
  highlight?: boolean; // bold + orange accent (used for Quick Capture for field users)
}

const nav: NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: '⚡ Quick Notice', href: '/capture', highlight: true },
  { label: 'Variation Register', href: '/variations', roles: ['admin', 'office'] },
  { label: 'Archived Projects', href: '/archived', roles: ['admin', 'office'] },
  { label: 'Team', href: '/team', roles: ['admin'] },
  { label: 'Settings', href: '/settings' },
];

interface SidebarProps {
  /** Mobile drawer open state */
  open?: boolean;
  /** Called when the overlay or a nav link is tapped on mobile */
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role, isField, company } = useRole();

  const visibleNav = nav.filter(item => !item.roles || item.roles.includes(role));

  // For field users: move Quick Capture to the top
  const sortedNav = isField
    ? [
        ...visibleNav.filter(item => item.href === '/capture'),
        ...visibleNav.filter(item => item.href !== '/capture'),
      ]
    : visibleNav;

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
          fixed left-0 top-0 bottom-0 w-[240px] bg-[#1B365D] text-white flex flex-col z-50
          transition-transform duration-300 ease-in-out
          md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <Image src="/variation-shield-logo.jpg" alt="Variation Shield" width={32} height={32} className="rounded-md object-cover" />
            <span className="font-semibold text-[15px] tracking-tight">Variation Shield</span>
          </div>
          {company && (
            <div className="mt-2 text-[11px] text-white/40 truncate">{company.name}</div>
          )}
        </div>
        <nav className="flex-1 px-3 pt-2 space-y-0.5">
          {sortedNav.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const isCapture = item.href === '/capture';
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`relative flex items-center px-3 py-2 rounded text-[13px] transition-colors duration-[120ms] ease-out ${
                  active
                    ? 'bg-white/10 text-white font-semibold'
                    : isCapture
                    ? 'text-[#D4A853] hover:text-[#E8C47A] hover:bg-white/5 font-semibold'
                    : 'text-white/60 hover:text-white/90 hover:bg-white/5 font-medium'
                }`}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#D4A853] rounded-r" />}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-6 py-4">
          <div className="text-[11px] text-white/40 capitalize">{role} access</div>
        </div>
      </aside>
    </>
  );
}
