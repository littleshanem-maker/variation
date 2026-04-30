'use client';
import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function RejectForm() {
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
        body: JSON.stringify({ token, comment, respondentEmail }),
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
            <div className="w-16 h-16 rounded-full bg-[#FBE6E4] flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-medium text-[#111827] mb-3">Variation Rejected</h1>
          <p className="text-[#334155] text-sm leading-relaxed mb-2">
            <strong className="text-[#111827]">{ref}</strong> has been rejected.
          </p>
          <p className="text-[#4B5563] text-sm leading-relaxed">
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
            <div className="w-12 h-12 rounded-full bg-[#FBE6E4] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-medium text-[#111827] mb-2">Reject {ref}</h1>
          <p className="text-[#4B5563] text-sm">Please provide a reason (optional but helpful).</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="e.g. Cost breakdown not aligned with contract rates, please revise labour hours."
            rows={4}
            className="w-full bg-[#F5F2EA] border border-[#D8D2C4] rounded-lg px-4 py-3 text-[#111827] text-sm placeholder:text-[#4B5563] resize-none focus:outline-none focus:ring-2 focus:ring-[#FBE6E4] focus:border-[#B42318]"
          />
          {error && <p className="text-[#B42318] text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#B42318] hover:bg-[#7A1810] disabled:opacity-50 text-[#FFFCF5] font-medium py-3 rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Submitting…' : 'Confirm Rejection'}
          </button>
          <p className="text-center text-[#4B5563] text-xs">
            Changed your mind?{' '}
            <a
              href={`/api/variation-response?token=${token}&action=approve${respondentEmail ? `&respondent=${encodeURIComponent(respondentEmail)}` : ''}`}
              className="text-[#2E7D32] hover:underline"
            >
              Approve instead
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function RejectPage() {
  return (
    <Suspense>
      <RejectForm />
    </Suspense>
  );
}
