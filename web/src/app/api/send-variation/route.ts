import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Variation Shield <hello@leveragedsystems.com.au>';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, message, pdfBase64, pdfFilename, variationNumber, projectName, value, senderName } = body;

    if (!to || !subject || !pdfBase64) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, pdfBase64' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid recipient email address' }, { status: 400 });
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      html: buildEmailHtml({ variationNumber, projectName, value, message, senderName }),
      attachments: [
        {
          filename: pdfFilename || `${variationNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error('Send variation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function buildEmailHtml({ variationNumber, projectName, value, message, senderName }: {
  variationNumber?: string;
  projectName?: string;
  value?: string;
  message?: string;
  senderName?: string;
}) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Variation Notice</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#020617;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.3px;">Variation Shield</p>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:12px;">Variation Notice</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${variationNumber ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:6px;margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Variation</p>
                  <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1e293b;font-family:monospace;">${variationNumber}</p>
                  ${projectName ? `<p style="margin:2px 0 0;font-size:13px;color:#64748b;">${projectName}</p>` : ''}
                  ${value ? `<p style="margin:8px 0 0;font-size:16px;font-weight:600;color:#1e293b;">${value}</p>` : ''}
                </td>
              </tr>
            </table>` : ''}

            ${message ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151;white-space:pre-wrap;">${message}</p>` : `
            <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#374151;">
              Please find the attached variation documentation for your review and approval.
              The details of the scope change, pricing, and supporting evidence are included in the PDF.
            </p>`}

            <p style="margin:0;font-size:14px;color:#374151;">Please review and respond at your earliest convenience.</p>

            ${senderName ? `<p style="margin:20px 0 0;font-size:14px;color:#374151;">Regards,<br><strong>${senderName}</strong></p>` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              This email was sent via <a href="https://app.leveragedsystems.com.au" style="color:#6366f1;text-decoration:none;">Variation Shield</a> by Leveraged Systems.
              The PDF attachment contains the full variation record including photos and supporting evidence.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
