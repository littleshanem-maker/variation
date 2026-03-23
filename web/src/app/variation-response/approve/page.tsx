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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Approve {ref}</h1>
          <p className="text-gray-500 text-sm">Add a comment for your records (optional).</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="e.g. Approved subject to invoice matching this breakdown. Proceed with works."
            rows={4}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 text-sm placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Submitting…' : 'Confirm Approval'}
          </button>
          <p className="text-center text-gray-400 text-xs">
            Changed your mind?{' '}
            <a
              href={`/api/variation-response?token=${token}&action=reject${respondentEmail ? `&respondent=${encodeURIComponent(respondentEmail)}` : ''}`}
              className="text-red-500 hover:underline"
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    }>
      <ApproveForm />
    </Suspense>
  );
}
