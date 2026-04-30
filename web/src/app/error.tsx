'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    try {
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message || 'Route error boundary triggered',
          stack: error?.stack || '',
          url: typeof window !== 'undefined' ? window.location.href : '',
          context: 'route-error',
        }),
      }).catch(() => {});
    } catch {
      // Never throw from error boundary
    }
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <h2
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '8px',
        }}
      >
        Something went wrong.
      </h2>
      <p
        style={{
          fontSize: '14px',
          color: '#334155',
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
          backgroundColor: '#17212B',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
