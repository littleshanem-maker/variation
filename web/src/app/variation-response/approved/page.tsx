'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ApprovedContent() {
  const params = useSearchParams();
  const ref = params.get('ref') || 'Variation';

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Variation Approved</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-2">
          <strong className="text-white">{ref}</strong> has been approved.
        </p>
        <p className="text-slate-500 text-sm leading-relaxed">
          The contractor has been notified. Thank you for your response.
        </p>
      </div>
    </div>
  );
}

export default function ApprovedPage() {
  return (
    <Suspense>
      <ApprovedContent />
    </Suspense>
  );
}
