'use client';

import Link from 'next/link';
import DemoButton from '@/components/DemoButton';

export default function MobileNav() {
  function close() {
    document.getElementById('mobile-nav')?.classList.add('hidden');
  }

  return (
    <div id="mobile-nav" className="hidden md:hidden fixed top-[64px] left-0 right-0 z-50 bg-[#FFFCF5] border-b border-[#D8D2C4] flex flex-col py-2 px-6 gap-0 shadow-xl">
      <a href="#problem" className="py-3.5 text-sm text-[#334155] border-b border-[#D8D2C4] active:text-[#111827]" onClick={close}>Problem</a>
      <a href="#how-it-works" className="py-3.5 text-sm text-[#334155] border-b border-[#D8D2C4] active:text-[#111827]" onClick={close}>How it works</a>
      <Link href="/calculator" className="py-3.5 text-sm text-[#334155] border-b border-[#D8D2C4] active:text-[#111827]" onClick={close}>Calculator</Link>
      <Link href="/login" className="py-3.5 text-sm text-[#334155] border-b border-[#D8D2C4] active:text-[#111827]">Login</Link>
      <DemoButton className="my-3 w-full text-center bg-[#E76F00] hover:bg-[#C75A00] text-[#FFFCF5] text-sm font-medium px-4 py-3 rounded-md">Book pilot</DemoButton>
    </div>
  );
}
