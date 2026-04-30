'use client';

import Link from 'next/link';
import { useState } from 'react';
import DemoRequestModal from '@/components/DemoRequestModal';
import Logo from '@/components/Logo';

export default function SchedulePage() {
  const [open, setOpen] = useState(true);

  return (
    <main className="min-h-screen bg-[#1a2338] text-white flex items-center justify-center px-6 py-16">
      <div className="max-w-xl text-center">
        <div className="flex justify-center mb-6">
          <Logo size={64} />
        </div>
        <p className="text-indigo-300 text-xs font-bold tracking-widest uppercase mb-3">Variation Shield</p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-5">Book a 15-Minute Demo</h1>
        <p className="text-white/65 text-lg leading-relaxed mb-8">
          Tell us where variations are getting missed, delayed or disputed. We’ll show you how to test Variation Shield on live work with founder-led setup.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center bg-[#E76F00] hover:bg-[#E76F00] text-white font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-lg shadow-[#E76F00]/25"
        >
          Open demo request
        </button>
        <div className="mt-6 text-sm text-white/50">
          Prefer to look around first?{' '}
          <Link href="/signup/free" className="text-indigo-300 hover:text-indigo-200">Try Free</Link>
        </div>
      </div>
      <DemoRequestModal isOpen={open} onClose={() => setOpen(false)} />
    </main>
  );
}
