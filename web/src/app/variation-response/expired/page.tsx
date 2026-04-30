'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ExpiredContent() {
  const params = useSearchParams();
  const reason = params.get('reason');
  const isCc = reason === 'cc';

  return (
    <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-[#FFFCF5] rounded-2xl shadow-sm border border-[#D8D2C4] p-10">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#F5F2EA] flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        </div>
        {isCc ? (
          <>
            <h1 className="text-2xl font-medium text-[#111827] mb-3">CC Recipients Cannot Respond</h1>
            <p className="text-[#6B7280] text-sm leading-relaxed">
              You were CC&apos;d on this variation for your records only. Only the primary recipient can approve or reject it.
              Please contact them directly if you need to provide input.
            </p>
          </>
        ) : reason === 'already-responded' ? (
          <>
            <h1 className="text-2xl font-medium text-[#111827] mb-3">This variation has already been actioned</h1>
            <p className="text-[#6B7280] text-sm leading-relaxed">
              Your response has been recorded. If you need to amend it, please contact the contractor directly.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-medium text-[#111827] mb-3">Link Expired</h1>
            <p className="text-[#6B7280] text-sm leading-relaxed">
              This approval link has expired or is no longer valid.
              Please contact the contractor directly to respond to this variation.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ExpiredPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-[#FFFCF5] rounded-2xl shadow-sm border border-[#D8D2C4] p-10">
          <h1 className="text-2xl font-medium text-[#111827] mb-3">Link Expired</h1>
          <p className="text-[#6B7280] text-sm leading-relaxed">This approval link has expired or is no longer valid.</p>
        </div>
      </div>
    }>
      <ExpiredContent />
    </Suspense>
  );
}
