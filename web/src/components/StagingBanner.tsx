import { isStagingEnvironment } from '@/lib/runtime';

export default function StagingBanner() {
  if (!isStagingEnvironment()) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] bg-amber-400 px-3 py-2 text-center text-[12px] font-black uppercase tracking-[0.16em] text-slate-950 shadow-lg">
      STAGING / V2 — TEST DATA ONLY — NOT LIVE
    </div>
  );
}
