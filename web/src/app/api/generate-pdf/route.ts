import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // Dynamic imports — avoid bundling in client builds
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chromium = ((await import('@sparticuz/chromium-min')) as any).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puppeteer = ((await import('puppeteer-core')) as any).default;

  let browser: any = null;

  try {
    const { html, css } = await req.json();

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
</body>
</html>`;

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('PDF timeout after 25s')), 25000)
    );

    await Promise.race([page.setContent(fullHtml, { waitUntil: 'networkidle0' }), timeoutPromise]);

    const pdfBuffer = await Promise.race([
      page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      }),
      timeoutPromise,
    ]) as Buffer;

    return new NextResponse(Buffer.from(pdfBuffer), {
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
