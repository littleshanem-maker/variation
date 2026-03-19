'use client';

import Link from 'next/link';
import Logo from './Logo';
import { useRole } from '@/lib/role';

export default function MobileTopBar() {
  const { company } = useRole();

  const trialBanner = (() => {
    if (!company?.created_at) return null;
    const trialEnd = new Date(company.created_at);
    trialEnd.setDate(trialEnd.getDate() + 30);
    const daysLeft = Math.ceil((trialEnd.getTime() - Date.now()) / 86400000);
    if (daysLeft > 14) return null; // only show when ≤14 days left
    const isExpired = daysLeft <= 0;
    const isExpiring = daysLeft <= 7;
    return (
      <div className={`text-center text-[11px] font-semibold py-1 px-3 ${
        isExpired ? 'bg-rose-600 text-white' :
        isExpiring ? 'bg-amber-500 text-white' :
        'bg-indigo-600/80 text-white'
      }`}>
        {isExpired ? 'Trial expired — contact us to continue' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in free trial`}
      </div>
    );
  })();

  return (
    <>
      <header className="h-14 bg-[#020617] text-white flex items-center justify-center px-4 sticky top-0 z-40 border-b border-white/[0.06]">
        <a href="https://variationshield.com.au" className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-semibold text-[15px] tracking-tight">Variation Shield</span>
        </a>
      </header>
      {trialBanner}
    </>
  );
}
