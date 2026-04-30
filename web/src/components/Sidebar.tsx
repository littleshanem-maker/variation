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
  { label: 'Variation register', href: '/variations',     icon: ClipboardList,  roles: ['admin', 'office'] },
  { label: 'Archived projects',  href: '/archived',       icon: Archive,        roles: ['admin', 'office'] },
  { label: 'Team',               href: '/team',           icon: Users,          roles: ['admin'] },
  { label: 'Notifications',      href: '/notifications',  icon: Bell,           roles: ['admin', 'office'] },
  { label: 'Settings',           href: '/settings',       icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { role, company } = useRole();
  const [notifCount, setNotifCount] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [varCount, setVarCount] = useState(0);
  const [varLimit, setVarLimit] = useState<number | null>(null);
  const plan = company?.plan ?? null;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      // Count unseen client responses — scoped to user ID to prevent cross-account bleed
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (!s) return;
        const seenKey = `vs_seen_notifications_${s.user.id}`;
        supabase
          .from('variations')
          .select('id')
          .in('client_approval_response', ['approved', 'rejected'])
          .then(({ data }) => {
            if (!data) return;
            try {
              const seen = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]'));
              setNotifCount(data.filter((v: any) => !seen.has(v.id)).length);
            } catch { setNotifCount(data.length); }
          });
      });
    });
  }, [pathname]);

  // Fetch variation count for free plan users
  useEffect(() => {
    if (!company?.id || company.plan !== 'free') return;
    setVarCount(company.variation_count ?? 0);
    setVarLimit(company.variation_limit ?? null);
  }, [company]);

  const visibleNav = nav.filter(item => !item.roles || item.roles.includes(role));

  return (
    <>

      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] bg-[#17212B] text-[#FFFCF5] flex-col z-50">
        <div className="px-6 py-6">
          <a href="https://variationshield.com.au" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Logo size={32} />
            <span className="font-medium text-[15px] tracking-tight">Variation Shield</span>
          </a>
          {company && (
            <div className="mt-2 text-[12px] text-[#4B5563] truncate">{company.name}</div>
          )}
        </div>

        {role === 'field' && (
          <div className="px-3 pb-2">
            <Link
              href="/capture"
              className="flex items-center gap-2.5 px-3 py-2 border border-[#B84C00] bg-[#B84C00] text-[#FFFCF5] text-[13px] font-medium hover:bg-[#9A3F00] hover:border-[#9A3F00] hover:-translate-y-px transition-all"
            >
              <Zap size={15} strokeWidth={2.5} />
              Quick capture
            </Link>
          </div>
        )}

        <nav className="flex-1 px-3 pt-1 space-y-0.5">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center justify-between gap-2.5 px-3 py-2.5 text-[13px] transition-colors duration-[120ms] ease-out ${
                  active
                    ? 'text-[#FFFCF5] font-medium bg-[#FFFCF5]/[0.04]'
                    : 'text-[#FFFCF5]/55 hover:text-[#FFFCF5] hover:bg-[#FFFCF5]/[0.03] font-medium'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#B84C00] rounded-r" />
                  )}
                  <Icon
                    size={15}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={active ? 'text-[#FFFCF5]' : 'text-[#FFFCF5]/50'}
                  />
                  {item.label}
                </div>
                {item.href === '/notifications' && notifCount > 0 && (
                  <span className="num flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium bg-[#B42318] text-[#FFFCF5] rounded-full">
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>


        {plan === 'free' && varLimit !== null && (
          <div className="px-4 pb-2">
            <div className={`rounded-lg px-3 py-2.5 text-[11px] ${
              varCount >= varLimit
                ? 'bg-[#FBE6E4] border border-[#B42318]/20'
                : varCount >= varLimit - 1
                ? 'bg-[#FBF1D6] border border-[#8C6500]/20'
                : 'bg-[#FFFCF5]/[0.04] border border-[#FFFCF5]/[0.08]'
            }`}>
              <div className={`mb-1 ${
                varCount >= varLimit ? 'text-[#7A1810]' : varCount >= varLimit - 1 ? 'text-[#8C6500]' : 'text-[#FFFCF5]/70'
              }`}>
                <span className="cond text-[11px]">Usage</span>{' '}
                <span className="num">{varCount}</span> / <span className="num">{varLimit}</span> variations used
              </div>
              <div className="w-full bg-[#FFFCF5]/10 rounded-full h-1 mb-2">
                <div
                  className={`h-1 rounded-full transition-all ${
                    varCount >= varLimit ? 'bg-[#B42318]' : varCount >= varLimit - 1 ? 'bg-[#8C6500]' : 'bg-[#B84C00]'
                  }`}
                  style={{ width: `${Math.min(100, (varCount / varLimit) * 100)}%` }}
                />
              </div>
              {varCount >= varLimit ? (
                <a href="https://buy.stripe.com/3cI00j9wN8ZQ1Gs90XfrW02" className="text-[#7A1810] hover:text-[#B42318] font-medium">
                  Upgrade to capture more
                </a>
              ) : (
                <span className="text-[#FFFCF5]/40"><span className="num">{varLimit - varCount}</span> remaining</span>
              )}
            </div>
          </div>
        )}

        <div className="px-3 py-4 space-y-1">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-[#FFFCF5]/55 hover:text-[#FFFCF5] hover:bg-[#FFFCF5]/[0.03] transition-colors"
          >
            <MessageSquare size={15} strokeWidth={1.8} className="text-[#FFFCF5]/50" />
            Feedback
          </button>
          <div className="px-3 pt-1">
            <div className="cond text-[11px] text-[#FFFCF5]/30 capitalize">{role} access</div>
          </div>
        </div>
      </aside>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
