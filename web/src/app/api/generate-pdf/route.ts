import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Dynamic imports — avoid bundling in client builds
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chromium = ((await import('@sparticuz/chromium-min')) as any).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puppeteer = ((await import('puppeteer-core')) as any).default;

  let browser: any = null;

  try {
    const { html, css, attachmentPdfUrls, isFree } = await req.json() as {
      html: string;
      css: string;
      attachmentPdfUrls?: string[]; // signed URLs of PDF attachments to merge
      isFree?: boolean; // if true, add watermark footer
    };

    if (!html || !css) {
      return NextResponse.json({ error: 'html and css required' }, { status: 400 });
    }

    const executablePath = await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
    );

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();

    const watermarkFooterHtml = isFree ? `
    <div style="position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #4B5563; padding: 6px 0; border-top: 1px solid #D8D2C4;">
      Generated with Variation Shield — variationshield.com.au | Upgrade to Pro to remove this watermark
    </div>` : '';

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    ${css}
    /* Force row integrity — never split a table row across pages */
    tbody tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    thead { display: table-header-group; }
    .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
  </style>
</head>
<body>
  <div style="padding: 0;">
    ${html}
  </div>
  ${watermarkFooterHtml}
</body>
</html>`;

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('PDF timeout after 25s')), 25000)
    );

    await Promise.race([page.setContent(fullHtml, { waitUntil: 'networkidle0' }), timeoutPromise]);

    const mainPdfBuffer = await Promise.race([
      page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      }),
      timeoutPromise,
    ]) as Buffer;

    // If no PDF attachments, return main PDF directly
    if (!attachmentPdfUrls || attachmentPdfUrls.length === 0) {
      return new NextResponse(Buffer.from(mainPdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="variation.pdf"',
        },
      });
    }

    // Merge attachment PDFs using pdf-lib
    const { PDFDocument } = await import('pdf-lib');

    const mergedDoc = await PDFDocument.create();

    // Add main PDF pages first
    const mainDoc = await PDFDocument.load(mainPdfBuffer);
    const mainPages = await mergedDoc.copyPages(mainDoc, mainDoc.getPageIndices());
    mainPages.forEach(p => mergedDoc.addPage(p));

    // Fetch and append each attachment PDF
    for (const url of attachmentPdfUrls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const attachDoc = await PDFDocument.load(buf);
        const attachPages = await mergedDoc.copyPages(attachDoc, attachDoc.getPageIndices());
        attachPages.forEach(p => mergedDoc.addPage(p));
      } catch (err) {
        console.error('[generate-pdf] Failed to merge attachment:', url, err);
        // Non-fatal — skip this attachment
      }
    }

    const mergedBytes = await mergedDoc.save();

    return new NextResponse(Buffer.from(mergedBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="variation.pdf"',
      },
    });

  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json(
      { error: 'PDF generation failed. Try with fewer photos or contact support.' },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
