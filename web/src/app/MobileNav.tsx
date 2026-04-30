'use client';

import Link from 'next/link';
import DemoButton from '@/components/DemoButton';

export default function MobileNav() {
  function close() {
    document.getElementById('mobile-nav')?.classList.add('hidden');
  }

  return (
    <div id="mobile-nav" className="hidden md:hidden fixed top-[64px] left-0 right-0 z-50 bg-[#FFFCF5] border-b border-[#D8D2C4] flex flex-col py-2 px-6 gap-0 shadow-xl">
      <a href="#features" className="py-3.5 text-sm text-[#334155] border-b border-[#D8D2C4] active:text-[#111827]" onClick={close}>Features</a>
      <a href="#how-it-works" className="py-3.5 text-sm text-[#334155] border-b border-[#D8D2C4] active:text-[#111827]" onClick={close}>How it works</a>
      <a href="#pricing" className="py-3.5 text-sm text-[#334155] border-b border-[#D8D2C4] active:text-[#111827]" onClick={close}>Pricing</a>
      <Link href="/calculator" className="py-3.5 text-sm text-[#334155] border-b border-[#D8D2C4] active:text-[#111827]" onClick={close}>ROI Calculator</Link>
      <Link href="/login" className="py-3.5 text-sm text-[#334155] border-b border-[#D8D2C4] active:text-[#111827]">Login</Link>
      <DemoButton className="my-3 w-full text-center bg-[#E76F00] hover:bg-[#C75A00] text-white text-sm font-semibold px-4 py-3 rounded-md">Book a 15-Minute Demo</DemoButton>
      <Link href="/signup/free" className="w-full text-center border border-[#D8D2C4] text-[#111827] text-sm font-semibold px-4 py-3 rounded-md">Try Free</Link>
    </div>
  );
}
