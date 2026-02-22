import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F8F6]">
      <Sidebar />
      <main className="ml-[240px]">
        {children}
      </main>
    </div>
  );
}
