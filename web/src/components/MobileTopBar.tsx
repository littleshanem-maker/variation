'use client';

import Image from 'next/image';

interface MobileTopBarProps {
  onMenuOpen: () => void;
}

export default function MobileTopBar({ onMenuOpen }: MobileTopBarProps) {
  return (
    <header className="h-14 bg-[#1B365D] text-white flex items-center justify-between px-4 sticky top-0 z-40 shadow-sm">
      <button
        onClick={onMenuOpen}
        aria-label="Open menu"
        className="p-2 -ml-1 text-white/80 hover:text-white transition-colors rounded-md hover:bg-white/10"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <rect y="3" width="20" height="2" rx="1" />
          <rect y="9" width="20" height="2" rx="1" />
          <rect y="15" width="20" height="2" rx="1" />
        </svg>
      </button>

      <div className="flex items-center gap-2">
        <Image
          src="/variation-shield-logo.jpg"
          alt="Variation Shield"
          width={26}
          height={26}
          className="rounded object-cover"
        />
        <span className="font-semibold text-[15px] tracking-tight">Variation Shield</span>
      </div>

      {/* Spacer to balance the hamburger */}
      <div className="w-9" aria-hidden="true" />
    </header>
  );
}
