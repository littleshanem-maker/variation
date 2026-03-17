'use client';
import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.leveragedsystems.com.au';

function RejectForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const ref = params.get('ref') || 'Variation';
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
        body: JSON.stringify({ token, comment }),
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
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Variation Rejected</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-2">
            <strong className="text-white">{ref}</strong> has been rejected.
          </p>
          <p className="text-slate-500 text-sm leading-relaxed">
            The contractor has been notified. Thank you for your response.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Reject {ref}</h1>
          <p className="text-slate-400 text-sm">Please provide a reason (optional but helpful).</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="e.g. Cost breakdown not aligned with contract rates, please revise labour hours."
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Submitting…' : 'Confirm Rejection'}
          </button>
          <p className="text-center text-slate-600 text-xs">
            Changed your mind?{' '}
            <a
              href={`/api/variation-response?token=${token}&action=approve`}
              className="text-emerald-500 hover:underline"
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
