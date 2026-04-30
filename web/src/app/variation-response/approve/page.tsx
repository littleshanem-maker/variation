'use client';
import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function ApproveForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const ref = params.get('ref') || 'Variation';
  const respondentEmail = params.get('respondent') || '';
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/variation-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'approve', comment, respondentEmail }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setDone(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
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
          <p className="text-[#6B7280] text-sm leading-relaxed">
            The contractor has been notified. Thank you for your response.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#FFFCF5] rounded-2xl shadow-sm border border-[#D8D2C4] p-8">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-12 h-12 rounded-full bg-[#E5F0E6] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-medium text-[#111827] mb-2">Approve {ref}</h1>
          <p className="text-[#6B7280] text-sm">Add a comment for your records (optional).</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="e.g. Approved subject to invoice matching this breakdown. Proceed with works."
            rows={4}
            className="w-full bg-[#F5F2EA] border border-[#D8D2C4] rounded-lg px-4 py-3 text-[#111827] text-sm placeholder:text-[#6B7280] resize-none focus:outline-none focus:ring-2 focus:ring-[#E5F0E6] focus:border-[#2E7D32]"
          />
          {error && <p className="text-[#B42318] text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#2E7D32] hover:bg-[#1F5223] disabled:opacity-50 text-[#FFFCF5] font-medium py-3 rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Submitting…' : 'Confirm Approval'}
          </button>
          <p className="text-center text-[#6B7280] text-xs">
            Changed your mind?{' '}
            <a
              href={`/api/variation-response?token=${token}&action=reject${respondentEmail ? `&respondent=${encodeURIComponent(respondentEmail)}` : ''}`}
              className="text-[#B42318] hover:underline"
            >
              Reject instead
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function ApprovePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center">
        <div className="text-[#6B7280] text-sm">Loading…</div>
      </div>
    }>
      <ApproveForm />
    </Suspense>
  );
}
