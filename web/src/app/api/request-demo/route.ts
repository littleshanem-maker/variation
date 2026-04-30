import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'test_key_placeholder');
const FROM_DOMAIN = process.env.RESEND_FROM_DOMAIN || 'variationshield.com.au';
const NOTIFY_EMAIL = process.env.DEMO_NOTIFY_EMAIL || 'shane@leveragedsystems.com.au';

export async function POST(req: NextRequest) {
  try {
    const { name, company, email, phone, preferredTime } = await req.json() as {
      name: string;
      company: string;
      email: string;
      phone?: string;
      preferredTime?: string;
    };

    if (!name || !company || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — skipping email');
      return NextResponse.json({ ok: true });
    }

    const submittedAt = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', dateStyle: 'medium', timeStyle: 'short' });

    // Notify Shane
    await resend.emails.send({
      from: `Variation Shield <hello@${FROM_DOMAIN}>`,
      to: NOTIFY_EMAIL,
      subject: `📅 Demo request — ${name}, ${company}`,
      html: `
        <div style="font-family:'IBM Plex Sans',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#111827;color:#F5F2EA;border-radius:12px;">
          <div style="margin-bottom:24px;">
            <span style="background:#334155;color:#FFFCF5;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;letter-spacing:0.05em;">DEMO REQUEST</span>
          </div>
          <h2 style="margin:0 0 8px;font-size:22px;font-weight:500;">${name}</h2>
          <p style="margin:0 0 24px;color:#4B5563;font-size:15px;">${company}</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#4B5563;font-size:13px;width:120px;">Email</td><td style="padding:8px 0;font-size:14px;"><a href="mailto:${email}" style="color:#334155;">${email}</a></td></tr>
            ${phone ? `<tr><td style="padding:8px 0;color:#4B5563;font-size:13px;">Phone</td><td style="padding:8px 0;font-size:14px;">${phone}</td></tr>` : ''}
            ${preferredTime ? `<tr><td style="padding:8px 0;color:#4B5563;font-size:13px;">Preferred time</td><td style="padding:8px 0;font-size:14px;">${preferredTime}</td></tr>` : ''}
            <tr><td style="padding:8px 0;color:#4B5563;font-size:13px;">Submitted</td><td style="padding:8px 0;font-size:14px;">${submittedAt} AEDT</td></tr>
          </table>
          <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,252,245,0.08);">
            <a href="mailto:${email}?subject=Re: Variation Shield Demo" style="display:inline-block;background:#334155;color:#FFFCF5;padding:12px 24px;border-radius:8px;font-weight:500;font-size:14px;text-decoration:none;">Reply to ${name.split(' ')[0]} →</a>
          </div>
        </div>
      `,
    });

    // Confirmation to requester
    await resend.emails.send({
      from: `Shane at Variation Shield <hello@${FROM_DOMAIN}>`,
      to: email,
      subject: `Demo request received — Variation Shield`,
      html: `
        <div style="font-family:'IBM Plex Sans',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#111827;color:#F5F2EA;border-radius:12px;">
          <h2 style="margin:0 0 16px;font-size:22px;font-weight:500;">Thanks, ${name.split(' ')[0]}.</h2>
          <p style="color:#4B5563;font-size:15px;line-height:1.6;margin:0 0 16px;">I'll be in touch within one business day to lock in a time that works for you.</p>
          <p style="color:#4B5563;font-size:15px;line-height:1.6;margin:0 0 24px;">The demo takes 15 minutes. I'll walk you through capturing a variation on-site, sending it to a client, and what it looks like when they receive it.</p>
          <p style="color:#4B5563;font-size:13px;margin:0;">— Shane<br>Founder, Variation Shield</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('request-demo error:', err);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
