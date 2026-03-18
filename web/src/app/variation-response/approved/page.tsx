'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ApprovedContent() {
  const params = useSearchParams();
  const ref = params.get('ref') || 'Variation';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Variation Approved</h1>
        <p className="text-gray-600 text-sm leading-relaxed mb-2">
          <strong className="text-gray-900">{ref}</strong> has been approved.
        </p>
        <p className="text-gray-400 text-sm leading-relaxed">
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
