export default function ExpiredPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Link Expired</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          This approval link has expired or is no longer valid.
          Please contact the contractor directly to respond to this variation.
        </p>
      </div>
    </div>
  );
}
