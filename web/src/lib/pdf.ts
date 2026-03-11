import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Renders an HTML string to a PDF blob.
 * Uses a hidden off-screen container, html2canvas, and jsPDF.
 */
export async function htmlToPdfBlob(htmlContent: string, cssContent: string): Promise<Blob> {
  // Create hidden container
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 794px;
    background: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  // Inject styles + content — generous top/bottom padding so first/last page edges are clear
  container.innerHTML = `<style>${cssContent}</style><div style="padding: 56px 40px;">${htmlContent}</div>`;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const sideMargin = 12;  // mm — left/right
    const topMargin = 22;   // mm — generous top breathing room on every page
    const botMargin = 22;   // mm — generous bottom breathing room on every page
    const usableWidth = pageWidth - sideMargin * 2;
    const usableHeight = pageHeight - topMargin - botMargin;

    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    let heightLeft = imgHeight;
    let yOffset = 0;

    // First page — image starts at (sideMargin, topMargin)
    pdf.addImage(imgData, 'JPEG', sideMargin, topMargin, imgWidth, imgHeight);
    heightLeft -= usableHeight;

    // Subsequent pages — shift image up so correct slice shows in the content area
    while (heightLeft > 0) {
      yOffset += usableHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', sideMargin, topMargin - yOffset, imgWidth, imgHeight);
      heightLeft -= usableHeight;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
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
