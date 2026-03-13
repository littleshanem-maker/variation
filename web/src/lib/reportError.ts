export async function reportError(error: Error, context?: string): Promise<void> {
  try {
    await fetch('/api/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error?.message || String(error),
        stack: error?.stack || '',
        url: typeof window !== 'undefined' ? window.location.href : '',
        context: context || 'manual',
      }),
    });
  } catch {
    // Silently fail — never throw from the error reporter
  }
}
