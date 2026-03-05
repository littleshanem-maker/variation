'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function MobileTopBar() {
  return (
    <header className="h-14 bg-[#020617] text-white flex items-center justify-center px-4 sticky top-0 z-40 border-b border-white/[0.06]">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center overflow-hidden flex-shrink-0">
          <Image
            src="/variation-shield-logo.jpg"
            alt="Variation Shield"
            width={28}
            height={28}
            className="object-cover"
          />
        </div>
        <span className="font-semibold text-[15px] tracking-tight">Variation Shield</span>
      </Link>
    </header>
  );
}
