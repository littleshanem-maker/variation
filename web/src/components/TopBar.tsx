'use client';

export default function TopBar({ title }: { title: string }) {
  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          🖨 Print Register
        </button>
        <span className="px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full uppercase tracking-wide">
          Office Mode
        </span>
      </div>
    </header>
  );
}
