'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import MobileTopBar from './MobileTopBar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8F8F6]">
      {/* Sidebar — desktop: always visible; mobile: drawer controlled by sidebarOpen */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile top bar — only visible below md breakpoint */}
      <div className="md:hidden">
        <MobileTopBar onMenuOpen={() => setSidebarOpen(true)} />
      </div>

      {/* Main content — no left margin on mobile, 240px offset on desktop */}
      <main className="md:ml-[240px]">
        {children}
      </main>
    </div>
  );
}
