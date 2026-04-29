import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { resolveOutboundRecipients, stagingEmailBanner } from '@/lib/runtime';

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
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#0f172a;padding:20px 32px;text-align:left;">
            <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.3px;">
              <span style="color:#7c3aed;">⬡</span> Variation Shield
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">${greeting}</p>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              <strong>${ref}</strong> has been issued by <strong>${companyName}</strong> for your records.
            </p>
            <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
              ${pdfBase64 ? 'The full notice is attached as a PDF.' : 'Please contact us if you require a copy of the notice.'}
            </p>
            <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">
              You can respond directly to this email or contact ${senderName || companyName} directly.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;">
            <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.5;">
              Sent via <a href="https://variationshield.com.au" style="color:#7c3aed;text-decoration:none;">Variation Shield</a> on behalf of ${companyName}.
              Issued on ${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const toDelivery = resolveOutboundRecipients(toEmails);
    const ccDelivery = resolveOutboundRecipients(ccEmails || []);
    let data: { id?: string } | null = null;
    let error: unknown = null;

    if (toDelivery.skipped) {
      console.warn('[send-notice] Email skipped by environment settings', { originalRecipients: toDelivery.originalRecipients });
    } else {
      const result = await resend.emails.send({
        from: fromAddress,
        to: toDelivery.recipients,
        ...(ccEmails && ccEmails.length > 0 && !ccDelivery.skipped ? { cc: ccDelivery.recipients } : {}),
        replyTo: senderEmail,
        subject: toDelivery.redirected ? `[STAGING REDIRECT] ${subject}` : subject,
        html: `${stagingEmailBanner([...toDelivery.originalRecipients, ...ccDelivery.originalRecipients])}${htmlBody}`,
        ...(pdfBase64 ? { attachments: [{ filename, content: pdfBase64 }] } : {}),
      });
      data = result.data;
      error = result.error;
    }

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
