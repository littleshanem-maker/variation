import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const maxDuration = 30;

const resend = new Resend(process.env.RESEND_API_KEY || '');
const FROM_DOMAIN = process.env.RESEND_FROM_DOMAIN || 'variationshield.com.au';
const NOTIFY_EMAIL = process.env.DEMO_NOTIFY_EMAIL || 'shane@leveragedsystems.com.au';

export async function POST(req: NextRequest) {
  console.log('[feedback] POST received');
  console.log('[feedback] RESEND_API_KEY set:', !!process.env.RESEND_API_KEY);
  console.log('[feedback] NOTIFY_EMAIL:', NOTIFY_EMAIL);
  console.log('[feedback] FROM_DOMAIN:', FROM_DOMAIN);

  try {
    const body = await req.json();
    console.log('[feedback] body parsed:', JSON.stringify({ ...body, message: body.message?.slice(0, 50) }));

    const { message, userName = 'Unknown', userEmail = '', companyName = '' } = body;

    if (!message?.trim()) {
      console.log('[feedback] missing message — returning 400');
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    console.log('[feedback] sending email via Resend...');
    const submittedAt = new Date().toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const emailResult = await resend.emails.send({
      from: `Variation Shield <hello@${FROM_DOMAIN}>`,
      to: NOTIFY_EMAIL,
      subject: `💬 Feedback — ${userName}${companyName ? `, ${companyName}` : ''}`,
      html: `
        <div style="font-family:'IBM Plex Sans',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#111827;color:#F5F2EA;border-radius:12px;">
          <div style="margin-bottom:20px;">
            <span style="background:#334155;color:#FFFCF5;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;letter-spacing:0.05em;">PRODUCT FEEDBACK</span>
          </div>
          <h2 style="margin:0 0 4px;font-size:18px;font-weight:500;">${userName}</h2>
          <p style="margin:0 0 20px;color:#4B5563;font-size:13px;">${companyName}${userEmail ? ` · ${userEmail}` : ''}</p>
          <div style="background:rgba(255,252,245,0.04);border:1px solid rgba(255,252,245,0.08);border-radius:10px;padding:16px 20px;margin-bottom:20px;">
            <p style="margin:0;font-size:14px;line-height:1.7;color:#D8D2C4;white-space:pre-wrap;">${message.trim()}</p>
          </div>
          <p style="font-size:12px;color:#334155;margin-top:16px;">${submittedAt} AEDT</p>
        </div>
      `,
    });

    console.log('[feedback] Resend result:', JSON.stringify(emailResult));

    if (emailResult.error) {
      console.error('[feedback] Resend error:', emailResult.error);
      return NextResponse.json({ error: 'Email delivery failed', detail: emailResult.error }, { status: 500 });
    }

    console.log('[feedback] email sent successfully, id:', emailResult.data?.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[feedback] caught error:', err);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}
