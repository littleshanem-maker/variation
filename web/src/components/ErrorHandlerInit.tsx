'use client';

import { useEffect } from 'react';

export function ErrorHandlerInit() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      try {
        const error = event.reason;
        const message =
          error instanceof Error ? error.message : String(error ?? 'Unhandled promise rejection');
        const stack = error instanceof Error ? error.stack || '' : '';

        fetch('/api/error-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            stack,
            url: window.location.href,
            context: 'unhandled-promise',
          }),
        }).catch(() => {});
      } catch {
        // Never throw from error handler
      }
    };

    const handleWindowError = (
      message: string | Event,
      source?: string,
      line?: number,
      col?: number,
      error?: Error
    ) => {
      try {
        fetch('/api/error-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: error?.message || String(message),
            stack: error?.stack || `${source}:${line}:${col}`,
            url: window.location.href,
            context: 'window-error',
          }),
        }).catch(() => {});
      } catch {
        // Never throw from error handler
      }
      return false; // Don't suppress the error
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.onerror = handleWindowError;

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.onerror = null;
    };
  }, []);

  return null;
}
