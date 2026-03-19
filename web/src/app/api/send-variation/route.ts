import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase';

export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY || 'test_key_placeholder');
const FROM_DOMAIN = process.env.RESEND_FROM_DOMAIN || 'leveragedsystems.com.au';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.leveragedsystems.com.au';

export async function POST(req: NextRequest) {
  try {
    const {
      variationId,
      approvalToken,
      toEmail,
      toEmails: toEmailsRaw,
      ccEmails,
      toName,
      pdfBase64,
      filename,
      subject,
      companyName,
      senderEmail,
      senderName,
      variationNumber,
      sequenceNumber,
    } = await req.json() as {
      variationId: string;
      approvalToken?: string;
      toEmail?: string;
      toEmails?: string[];
      ccEmails?: string[];
      toName?: string;
      pdfBase64?: string | null;
      filename: string;
      subject: string;
      companyName: string;
      senderEmail: string;
      senderName?: string;
      variationNumber?: string;
      sequenceNumber?: number;
    };

    // Support both toEmail (legacy) and toEmails (array)
    const toEmails = toEmailsRaw ?? (toEmail ? [toEmail] : []);

    if (!variationId || !toEmails.length || !subject || !companyName || !senderEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Use token passed from client — avoids RLS issues server-side
    // Fall back to DB fetch only if token not provided
    let resolvedToken = approvalToken;
    let resolvedVarRef = variationNumber ?? (sequenceNumber ? `VAR-${String(sequenceNumber).padStart(3, '0')}` : 'VAR');

    if (!resolvedToken) {
      const supabase = createSupabaseBrowserClient();
      const { data: v, error: varError } = await supabase
        .from('variations')
        .select('approval_token, variation_number, sequence_number')
        .eq('id', variationId)
        .single();
      if (varError || !v) {
        console.error('[send-variation] Failed to fetch variation:', varError);
        return NextResponse.json({ error: 'Variation not found' }, { status: 404 });
      }
      resolvedToken = v.approval_token;
      resolvedVarRef = v.variation_number ?? `VAR-${String(v.sequence_number).padStart(3, '0')}`;
    }

    const approveUrl = `${APP_URL}/api/variation-response?token=${resolvedToken}&action=approve`;
    const rejectUrl = `${APP_URL}/api/variation-response?token=${resolvedToken}&action=reject`;

    const fromAddress = `${companyName} via Variation Shield <noreply@${FROM_DOMAIN}>`;
    const greeting = toName ? `Dear ${toName},` : 'Dear Sir/Madam,';
    const varRef = resolvedVarRef;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:20px 32px;text-align:left;">
            <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.3px;">
              <span style="color:#7c3aed;">⬡</span> Variation Shield
            </span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">${greeting}</p>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              <strong>${varRef}</strong> has been submitted by <strong>${companyName}</strong> for your review.
            </p>
            <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">
              Please review the variation details and indicate your response below.
            </p>
            <!-- Approve / Reject buttons -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="padding-right:12px;">
                  <a href="${approveUrl}"
                     style="display:inline-block;background:#16a34a;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;letter-spacing:0.1px;">
                    ✓ Approve Variation
                  </a>
                </td>
                <td>
                  <a href="${rejectUrl}"
                     style="display:inline-block;background:#ffffff;color:#dc2626;font-size:14px;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;border:1.5px solid #dc2626;letter-spacing:0.1px;">
                    ✗ Reject Variation
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:#6b7280;font-size:12px;line-height:1.5;">
              Or you may respond directly to this email or contact ${senderName || companyName} directly.
            </p>
            <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">
              The full variation details are included in the attached PDF.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;">
            <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.5;">
              Sent via <a href="https://variationshield.com.au" style="color:#7c3aed;text-decoration:none;">Variation Shield</a> on behalf of ${companyName}.
              This variation was submitted on ${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}.
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
      console.error('[send-variation] Resend error:', error);
      return NextResponse.json({ error: 'Failed to send email', detail: error }, { status: 500 });
    }

    // Update client_email on the variation record
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from('variations')
      .update({ client_email: toEmails.join(', ') })
      .eq('id', variationId);

    // Note: client_contacts saved client-side after successful send (needs auth session for RLS)

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    console.error('[send-variation] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
