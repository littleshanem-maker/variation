import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const maxDuration = 30;

const resend = new Resend(process.env.RESEND_API_KEY || '');
const FROM_DOMAIN = process.env.RESEND_FROM_DOMAIN || 'variationshield.com.au';
const NOTIFY_EMAIL = process.env.DEMO_NOTIFY_EMAIL || 'shane@variationshield.com.au';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const message = formData.get('message') as string;
    const userName = formData.get('userName') as string || 'Unknown';
    const userEmail = formData.get('userEmail') as string || '';
    const companyName = formData.get('companyName') as string || '';
    const file = formData.get('attachment') as File | null;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    let attachmentBase64: string | null = null;
    let attachmentName: string | null = null;

    if (file && file.size > 0) {
      attachmentName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      attachmentBase64 = Buffer.from(arrayBuffer).toString('base64');
    }

    if (process.env.RESEND_API_KEY) {
      const submittedAt = new Date().toLocaleString('en-AU', {
        timeZone: 'Australia/Melbourne',
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      await resend.emails.send({
        from: `Variation Shield <hello@${FROM_DOMAIN}>`,
        to: NOTIFY_EMAIL,
        subject: `💬 Feedback — ${userName}${companyName ? `, ${companyName}` : ''}`,
        attachments: attachmentBase64 && attachmentName ? [{
          filename: attachmentName,
          content: attachmentBase64,
        }] : [],
        html: `
          <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0f1117;color:#f1f5f9;border-radius:12px;">
            <div style="margin-bottom:20px;">
              <span style="background:#4f46e5;color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.05em;">PRODUCT FEEDBACK</span>
            </div>
            <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;">${userName}</h2>
            <p style="margin:0 0 20px;color:#64748b;font-size:13px;">${companyName}${userEmail ? ` · ${userEmail}` : ''}</p>
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0;font-size:14px;line-height:1.7;color:#cbd5e1;white-space:pre-wrap;">${message.trim()}</p>
            </div>
            <p style="font-size:12px;color:#475569;margin-top:16px;">${submittedAt} AEDT</p>
          </div>
        `,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('feedback error:', err);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}
