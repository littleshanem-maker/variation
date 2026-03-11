import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { html, css } = await req.json();

  if (!html || !css) {
    return NextResponse.json({ error: 'html and css required' }, { status: 400 });
  }

  // Dynamic imports — avoid bundling in client builds
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chromium = ((await import('@sparticuz/chromium-min')) as any).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puppeteer = ((await import('puppeteer-core')) as any).default;

  const executablePath = await chromium.executablePath(
    'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
  );

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });

  try {
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

    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer: Buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="variation.pdf"',
      },
    });
  } finally {
    await browser.close();
  }
}
