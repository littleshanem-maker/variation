'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { label: 'Dashboard', href: '/' },
  { label: 'Variation Register', href: '/variations' },
  { label: 'Archived Projects', href: '/archived' },
  { label: 'Settings', href: '/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-[#1B365D] text-white flex flex-col z-50">
      <div className="px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/10 rounded-md flex items-center justify-center text-sm font-semibold tracking-tight">VC</div>
          <span className="font-semibold text-[15px] tracking-tight">Variation Capture</span>
        </div>
      </div>
      <nav className="flex-1 px-3 pt-2 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center px-3 py-2 rounded text-[13px] font-medium transition-colors duration-[120ms] ease-out ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:text-white/90 hover:bg-white/5'
              }`}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#D4A853] rounded-r" />}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-5 text-[11px] text-white/30">
        Pipeline Consulting Pty Ltd
      </div>
    </aside>
  );
}
