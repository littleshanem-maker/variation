'use client';

import Sidebar from './Sidebar';
import MobileTopBar from './MobileTopBar';
import MobileBottomNav from './MobileBottomNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F8F6]">
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
