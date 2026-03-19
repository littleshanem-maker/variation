'use client';

import Link from 'next/link';
import Logo from './Logo';
import { useRole } from '@/lib/role';

export default function MobileTopBar() {
  return (
    <header className="h-14 bg-[#020617] text-white flex items-center justify-center px-4 sticky top-0 z-40 border-b border-white/[0.06]">
      <a href="https://variationshield.com.au" className="flex items-center gap-2.5">
        <Logo size={28} />
        <span className="font-semibold text-[15px] tracking-tight">Variation Shield</span>
      </a>
    </header>
  );
}
