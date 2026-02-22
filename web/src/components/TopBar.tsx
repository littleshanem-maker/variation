'use client';

export default function TopBar({ title, onPrint, printLabel = 'Print' }: { title: string; onPrint?: () => void; printLabel?: string }) {
  return (
    <header className="h-14 border-b border-[#E5E7EB] bg-white flex items-center justify-between px-8">
      <h1 className="text-lg font-semibold text-[#1C1C1E]">{title}</h1>
      <div className="flex items-center gap-3">
        {onPrint && (
        <button
          onClick={onPrint}
          className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-[#6B7280] bg-white border border-[#E5E7EB] rounded-md hover:bg-[#F5F3EF] transition-colors duration-[120ms] ease-out"
        >
          {printLabel}
        </button>
        )}
        <span className="px-2.5 py-1 text-[11px] font-semibold text-[#1B365D] bg-[#1B365D]/5 border border-[#1B365D]/10 rounded tracking-wide uppercase">
          Office
        </span>
      </div>
    </header>
  );
}
