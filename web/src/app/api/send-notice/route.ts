import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY || 'test_key_placeholder');
const FROM_DOMAIN = process.env.RESEND_FROM_DOMAIN || 'leveragedsystems.com.au';

export async function POST(req: NextRequest) {
  try {
    const {
      noticeId,
      toEmails,
      ccEmails,
      pdfBase64,
      filename,
      subject,
      companyName,
      senderEmail,
      senderName,
      noticeNumber,
    } = await req.json() as {
      noticeId: string;
      toEmails: string[];
      ccEmails?: string[];
      pdfBase64?: string | null;
      filename: string;
      subject: string;
      companyName: string;
      senderEmail: string;
      senderName?: string;
      noticeNumber?: string;
    };

    if (!noticeId || !toEmails?.length || !subject || !companyName || !senderEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const fromAddress = `${companyName} via Variation Shield <hello@${FROM_DOMAIN}>`;
    const ref = noticeNumber ?? 'Variation Notice';
    const greeting = 'Dear Sir/Madam,';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F2EA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EA;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFCF5;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#17212B;padding:20px 32px;text-align:left;">
            <span style="color:#FFFCF5;font-size:16px;font-weight:500;letter-spacing:-0.3px;">
              <span style="color:#334155;">⬡</span> Variation Shield
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">${greeting}</p>
            <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
              <strong>${ref}</strong> has been issued by <strong>${companyName}</strong> for your records.
            </p>
            <p style="margin:0 0 24px;color:#334155;font-size:14px;line-height:1.6;">
              ${pdfBase64 ? 'The full notice is attached as a PDF.' : 'Please contact us if you require a copy of the notice.'}
            </p>
            <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">
              You can respond directly to this email or contact ${senderName || companyName} directly.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#FFFCF5;border-top:1px solid #D8D2C4;padding:16px 32px;">
            <p style="margin:0;color:#6B7280;font-size:11px;line-height:1.5;">
              Sent via <a href="https://variationshield.com.au" style="color:#334155;text-decoration:none;">Variation Shield</a> on behalf of ${companyName}.
              Issued on ${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: toEmails,
      ...(ccEmails && ccEmails.length > 0 ? { cc: ccEmails } : {}),
      replyTo: senderEmail,
      subject,
      html: htmlBody,
      ...(pdfBase64 ? { attachments: [{ filename, content: pdfBase64 }] } : {}),
    });

    if (error) {
      console.error('[send-notice] Resend error:', error);
      return NextResponse.json({ error: 'Failed to send email', detail: error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    console.error('[send-notice] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
