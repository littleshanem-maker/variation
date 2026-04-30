'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Sidebar from './Sidebar';
import MobileTopBar from './MobileTopBar';
import MobileBottomNav from './MobileBottomNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.replace('/login');
      } else {
        setAuthed(true);
      }
    });
  }, []);

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-[#F5F2EA]">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar />

      {/* Mobile top bar — logo only, no hamburger */}
      <div className="md:hidden">
        <MobileTopBar />
      </div>

      {/* Main content */}
      <main className="md:ml-[240px] pb-24 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav + FAB */}
      <MobileBottomNav />
    </div>
  );
}
