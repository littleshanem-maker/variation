'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ApprovedContent() {
  const params = useSearchParams();
  const ref = params.get('ref') || 'Variation';

  return (
    <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-[#FFFCF5] rounded-2xl shadow-sm border border-[#D8D2C4] p-10">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#E5F0E6] flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-medium text-[#111827] mb-3">Variation Approved</h1>
        <p className="text-[#334155] text-sm leading-relaxed mb-2">
          <strong className="text-[#111827]">{ref}</strong> has been approved.
        </p>
        <p className="text-[#4B5563] text-sm leading-relaxed">
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
