/**
 * Renders an HTML string to a PDF blob via the server-side /api/generate-pdf route.
 * Uses Puppeteer + Chromium — respects CSS page-break-inside: avoid so rows never split.
 */
export async function htmlToPdfBlob(htmlContent: string, cssContent: string, attachmentPdfUrls?: string[]): Promise<Blob> {
  const res = await fetch('/api/generate-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: htmlContent, css: cssContent, attachmentPdfUrls }),
  });

  if (!res.ok) {
    throw new Error(`PDF generation failed: ${res.status} ${await res.text()}`);
  }

  return res.blob();
}

/**
 * Share or download a PDF blob, with optional extra attachment URLs.
 * - Mobile: Web Share API with all files at once (1-step)
 * - Desktop: download main PDF + each attachment, then open mailto
 */
export async function shareOrDownloadPdf(
  blob: Blob,
  filename: string,
  emailSubject: string,
  emailBody: string,
  attachmentUrls?: Array<{ url: string; filename: string; mimeType: string }>
): Promise<void> {
  const mainFile = new File([blob], filename, { type: 'application/pdf' });

  // Fetch additional attachment blobs if provided
  const extraFiles: File[] = [];
  if (attachmentUrls && attachmentUrls.length > 0) {
    for (const att of attachmentUrls) {
      try {
        const r = await fetch(att.url);
        if (r.ok) {
          const attBlob = await r.blob();
          extraFiles.push(new File([attBlob], att.filename, { type: att.mimeType }));
        }
      } catch (e) {
        console.warn('Could not fetch attachment:', att.filename, e);
      }
    }
  }

  const allFiles = [mainFile, ...extraFiles];

  // Try Web Share API with file support (mobile)
  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: allFiles })
  ) {
    try {
      await navigator.share({
        files: allFiles,
        title: emailSubject,
        text: emailBody,
      });
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    }
  }

  // Desktop: download main PDF
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  // Download each extra attachment with a small delay between each
  extraFiles.forEach((file, i) => {
    setTimeout(() => {
      const attUrl = URL.createObjectURL(file);
      const attA = document.createElement('a');
      attA.href = attUrl;
      attA.download = file.name;
      document.body.appendChild(attA);
      attA.click();
      document.body.removeChild(attA);
      setTimeout(() => URL.revokeObjectURL(attUrl), 10000);
    }, (i + 1) * 800);
  });

  // Open mailto after downloads start
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  setTimeout(() => { window.location.href = mailtoUrl; }, 500 + extraFiles.length * 800);
}
