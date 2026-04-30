'use client';

import Link from 'next/link';
import DemoButton from '@/components/DemoButton';

export default function MobileNav() {
  function close() {
    document.getElementById('mobile-nav')?.classList.add('hidden');
  }

  return (
    <div id="mobile-nav" className="hidden md:hidden fixed top-[64px] left-0 right-0 z-50 bg-[#1a2338] border-b border-white/[0.08] flex flex-col py-2 px-6 gap-0 shadow-xl">
      <a href="#features" className="py-3.5 text-sm text-white/60 border-b border-white/[0.06] active:text-white" onClick={close}>Features</a>
      <a href="#how-it-works" className="py-3.5 text-sm text-white/60 border-b border-white/[0.06] active:text-white" onClick={close}>How it works</a>
      <a href="#pricing" className="py-3.5 text-sm text-white/60 border-b border-white/[0.06] active:text-white" onClick={close}>Pricing</a>
      <Link href="/calculator" className="py-3.5 text-sm text-white/60 border-b border-white/[0.06] active:text-white" onClick={close}>ROI Calculator</Link>
      <Link href="/login" className="py-3.5 text-sm text-white/60 border-b border-white/[0.06] active:text-white">Login</Link>
      <DemoButton className="my-3 w-full text-center bg-[#E76F00] text-white text-sm font-semibold px-4 py-3 rounded-lg">Book a 15-Minute Demo</DemoButton>
      <Link href="/signup/free" className="w-full text-center border border-white/20 text-white/80 text-sm font-semibold px-4 py-3 rounded-lg">Try Free</Link>
    </div>
  );
}
