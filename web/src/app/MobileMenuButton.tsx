'use client';

export default function MobileMenuButton() {
  return (
    <button
      className="md:hidden flex flex-col gap-1.5 p-2"
      onClick={() => {
        const m = document.getElementById('mobile-nav');
        if (m) m.classList.toggle('hidden');
      }}
      aria-label="Menu"
    >
      <span className="block w-5 h-0.5 bg-[#111827]/60 rounded" />
      <span className="block w-5 h-0.5 bg-[#111827]/60 rounded" />
      <span className="block w-5 h-0.5 bg-[#111827]/60 rounded" />
    </button>
  );
}
