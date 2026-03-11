/**
 * Renders an HTML string to a PDF blob via the server-side /api/generate-pdf route.
 * Uses Puppeteer + Chromium — respects CSS page-break-inside: avoid so rows never split.
 */
export async function htmlToPdfBlob(htmlContent: string, cssContent: string): Promise<Blob> {
  const res = await fetch('/api/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: htmlContent, css: cssContent }),
  });

  if (!res.ok) {
    throw new Error(`PDF generation failed: ${res.status} ${await res.text()}`);
  }

  return res.blob();
}

/**
 * Share or download a PDF blob.
 * - Mobile: Web Share API with file attachment (1-step)
 * - Desktop: auto-download + mailto opens simultaneously
 */
export async function shareOrDownloadPdf(
  blob: Blob,
  filename: string,
  emailSubject: string,
  emailBody: string
): Promise<void> {
  const file = new File([blob], filename, { type: 'application/pdf' });

  // Try Web Share API with file support (mobile)
  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: emailSubject,
        text: emailBody,
      });
      return;
    } catch (err) {
      // User cancelled or share failed — fall through to download
      if ((err as Error).name === 'AbortError') return;
    }
  }

  // Desktop fallback: auto-download + open mailto simultaneously
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  // Open mailto after a short delay so download starts first
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  setTimeout(() => { window.location.href = mailtoUrl; }, 500);
}
