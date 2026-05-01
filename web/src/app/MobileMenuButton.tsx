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
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect y="0" width="20" height="2" rx="1" fill="#111827" fillOpacity="0.7"/>
        <rect y="7" width="20" height="2" rx="1" fill="#111827" fillOpacity="0.7"/>
        <rect y="14" width="20" height="2" rx="1" fill="#111827" fillOpacity="0.7"/>
      </svg>
    </button>
  );
}