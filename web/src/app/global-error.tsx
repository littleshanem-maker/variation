'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    try {
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message || 'Global error boundary triggered',
          stack: error?.stack || '',
          url: typeof window !== 'undefined' ? window.location.href : '',
          context: 'global-error',
        }),
      }).catch(() => {});
    } catch {
      // Never throw from error boundary
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#1C1C1E',
              marginBottom: '8px',
            }}
          >
            Something went wrong.
          </h1>
          <p
            style={{
              fontSize: '15px',
              color: '#6B7280',
              marginBottom: '24px',
            }}
          >
            Our team has been notified.
          </p>
          <button
            onClick={() => {
              try {
                reset();
              } catch {
                window.location.reload();
              }
            }}
            style={{
              backgroundColor: '#1B365D',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
