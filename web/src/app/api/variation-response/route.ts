import { NextRequest, NextResponse } from 'next/server';
import { createClient as createBrowserClient } from '@/lib/supabase';
import { Resend } from 'resend';
import { resolveOutboundRecipients, stagingEmailBanner } from '@/lib/runtime';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.leveragedsystems.com.au';
const FROM_DOMAIN = process.env.RESEND_FROM_DOMAIN || 'leveragedsystems.com.au';
const resend = new Resend(process.env.RESEND_API_KEY || 'test_key_placeholder');

async function notifyPM(opts: {
  toEmail: string;
  varRef: string;
  projectName: string;
  action: 'approved' | 'rejected';
  comment?: string;
  variationId: string;
  respondentEmail?: string;
}) {
  const { toEmail, varRef, projectName, action, comment, variationId, respondentEmail } = opts;
  if (!toEmail || !process.env.RESEND_API_KEY) return;

  const delivery = resolveOutboundRecipients(toEmail);
  if (delivery.skipped) {
    console.warn('[variation-response] PM notification skipped by environment settings', { originalRecipients: delivery.originalRecipients });
    return;
  }

  const responder = respondentEmail ? `<strong>${respondentEmail}</strong>` : 'the client';

  const subject = action === 'approved'
    ? `✅ ${varRef} approved by ${respondentEmail ?? 'client'} — ${projectName}`
    : `❌ ${varRef} rejected by ${respondentEmail ?? 'client'} — ${projectName}`;

  const bodyHtml = action === 'approved'
    ? `<p>Good news — <strong>${varRef}</strong> has been <strong style="color:#16a34a;">approved</strong> via the email link.</p>
       <p>Approved by: ${responder}</p>
       ${comment ? `<p>Approver's comment: <em>"${comment}"</em></p>` : ''}
       <p>Project: ${projectName}</p>
       <p><a href="${APP_URL}/variation/${variationId}" style="color:#4f46e5;">View variation →</a></p>
       <p style="color:#6b7280;font-size:12px;">Log in to mark as paid when the invoice is raised.</p>`
    : `<p><strong>${varRef}</strong> has been <strong style="color:#dc2626;">rejected</strong> via the email link.</p>
       <p>Rejected by: ${responder}</p>
       <p>Project: ${projectName}</p>
       ${comment ? `<p>Reason: <em>"${comment}"</em></p>` : ''}
       <p><a href="${APP_URL}/variation/${variationId}" style="color:#4f46e5;">View variation →</a></p>
       <p style="color:#6b7280;font-size:12px;">Log in to revise and resubmit.</p>`;

  try {
    await resend.emails.send({
      from: `Variation Shield <noreply@${FROM_DOMAIN}>`,
      to: delivery.recipients,
      subject: delivery.redirected ? `[STAGING REDIRECT] ${subject}` : subject,
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px;">${stagingEmailBanner(delivery.originalRecipients)}${bodyHtml}</body></html>`,
    });
  } catch (err) {
    console.error('[variation-response] PM notify error:', err);
  }
}

async function notifyApprover(opts: {
  toEmail: string;
  varRef: string;
  projectName: string;
  action: 'approved' | 'rejected';
  comment?: string;
  variationId: string;
  title?: string;
  estimatedValue?: number | null;
}) {
  const { toEmail, varRef, projectName, action, comment, variationId, title, estimatedValue } = opts;
  if (!toEmail || !process.env.RESEND_API_KEY) return;

  const delivery = resolveOutboundRecipients(toEmail);
  if (delivery.skipped) {
    console.warn('[variation-response] Approver receipt skipped by environment settings', { originalRecipients: delivery.originalRecipients });
    return;
  }

  const valueStr = estimatedValue ? `$${(estimatedValue / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;
  const timestamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', dateStyle: 'full', timeStyle: 'short' });

  const subject = action === 'approved'
    ? `Receipt: You approved ${varRef}`
    : `Receipt: You rejected ${varRef}`;

  const actionColour = action === 'approved' ? '#16a34a' : '#dc2626';
  const actionLabel = action === 'approved' ? 'Approved' : 'Rejected';

  const bodyHtml = `
    <p>This is a confirmation that you <strong style="color:${actionColour};">${actionLabel}</strong> the following variation request.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px 0;color:#6b7280;width:40%;">Reference</td><td style="padding:8px 0;font-weight:600;">${varRef}</td></tr>
      ${title ? `<tr><td style="padding:8px 0;color:#6b7280;">Description</td><td style="padding:8px 0;">${title}</td></tr>` : ''}
      ${valueStr ? `<tr><td style="padding:8px 0;color:#6b7280;">Amount</td><td style="padding:8px 0;font-weight:600;">${valueStr}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#6b7280;">Project</td><td style="padding:8px 0;">${projectName}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">Decision</td><td style="padding:8px 0;font-weight:600;color:${actionColour};">${actionLabel}</td></tr>
      ${comment ? `<tr><td style="padding:8px 0;color:#6b7280;">Your comment</td><td style="padding:8px 0;font-style:italic;">"${comment}"</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#6b7280;">Recorded at</td><td style="padding:8px 0;">${timestamp} (AEST)</td></tr>
    </table>
    <p><a href="${APP_URL}/variation/${variationId}" style="color:#4f46e5;">View variation →</a></p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px;">If this was not you, contact the sender of this variation immediately.<br>This receipt was generated automatically by Variation Shield.</p>`;

  try {
    await resend.emails.send({
      from: `Variation Shield <noreply@${FROM_DOMAIN}>`,
      to: delivery.recipients,
      subject: delivery.redirected ? `[STAGING REDIRECT] ${subject}` : subject,
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px;">${stagingEmailBanner(delivery.originalRecipients)}${bodyHtml}</body></html>`,
    });
  } catch (err) {
    console.error('[variation-response] approver receipt error:', err);
  }
}

// GET: Handle approve (direct redirect) or reject (show form)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action');
  const respondentEmail = searchParams.get('respondent') ? decodeURIComponent(searchParams.get('respondent')!) : null;

  if (!token || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.redirect(`${APP_URL}/variation-response/expired`);
  }

  const supabase = createBrowserClient();

  const { data: variation, error } = await supabase
    .from('variations')
    .select('id, variation_number, sequence_number, status, approval_token_expires_at, client_approval_response, requestor_email, project_id, client_email, cc_emails')
    .eq('approval_token', token)
    .single();

  if (error || !variation) {
    return NextResponse.redirect(`${APP_URL}/variation-response/expired`);
  }

  const expiresAt = variation.approval_token_expires_at ? new Date(variation.approval_token_expires_at) : null;
  if (expiresAt && expiresAt < new Date()) {
    return NextResponse.redirect(`${APP_URL}/variation-response/expired`);
  }

  // Block if already responded — one response only
  if (variation.client_approval_response) {
    return NextResponse.redirect(`${APP_URL}/variation-response/expired?reason=already-responded&prior=${variation.client_approval_response}`);
  }

  // Block CC recipients — only the primary To recipient(s) can respond
  if (respondentEmail && variation.cc_emails) {
    const ccList = variation.cc_emails.split(',').map((e: string) => e.trim().toLowerCase());
    if (ccList.includes(respondentEmail.toLowerCase())) {
      return NextResponse.redirect(`${APP_URL}/variation-response/expired?reason=cc`);
    }
  }

  const varRef = variation.variation_number ?? `VAR-${String(variation.sequence_number).padStart(3, '0')}`;
  const projectName = 'Project';

  if (action === 'approve') {
    // Redirect to intermediate form so approver can add a comment
    return NextResponse.redirect(
      `${APP_URL}/variation-response/approve?token=${token}&ref=${encodeURIComponent(varRef)}${respondentEmail ? `&respondent=${encodeURIComponent(respondentEmail)}` : ''}`
    );
  }

  if (action === 'reject') {
    return NextResponse.redirect(
      `${APP_URL}/variation-response/reject?token=${token}&ref=${encodeURIComponent(varRef)}&respondent=${encodeURIComponent(respondentEmail ?? '')}`
    );
  }

  return NextResponse.redirect(`${APP_URL}/variation-response/expired`);
}

// POST: Handle reject form submission
export async function POST(req: NextRequest) {
  try {
    const { token, action: bodyAction, comment, respondentEmail: bodyRespondentEmail } = await req.json() as { token: string; action?: string; comment?: string; respondentEmail?: string };

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const supabase = createBrowserClient();

    const { data: variation, error } = await supabase
      .from('variations')
      .select('id, variation_number, sequence_number, status, approval_token_expires_at, requestor_email, project_id, cc_emails, client_approval_response, title, estimated_value, client_email')
      .eq('approval_token', token)
      .single();

    if (error || !variation) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    const expiresAt = variation.approval_token_expires_at ? new Date(variation.approval_token_expires_at) : null;
    if (expiresAt && expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 410 });
    }

    // Block if already responded
    if (variation.client_approval_response) {
      return NextResponse.json({ error: 'You have already responded to this variation' }, { status: 409 });
    }

    // Block CC recipients
    if (bodyRespondentEmail && variation.cc_emails) {
      const ccList = variation.cc_emails.split(',').map((e: string) => e.trim().toLowerCase());
      if (ccList.includes(bodyRespondentEmail.toLowerCase())) {
        return NextResponse.json({ error: 'CC recipients cannot respond to variations' }, { status: 403 });
      }
    }

    const varRef = variation.variation_number ?? `VAR-${String(variation.sequence_number).padStart(3, '0')}`;
    const projectName = 'Project';

    // Handle approve action from the intermediate form
    if (bodyAction === 'approve') {
      await supabase
        .from('variations')
        .update({
          status: 'approved',
          client_approval_response: 'approved',
          client_approval_comment: comment || null,
          client_approved_at: new Date().toISOString(),
          client_approved_by_email: bodyRespondentEmail ?? null,
        })
        .eq('approval_token', token);

      await supabase.from('status_changes').insert({
        variation_id: variation.id,
        from_status: variation.status,
        to_status: 'approved',
        changed_by: 'client-email',
        note: bodyRespondentEmail
          ? `Approved via email by ${bodyRespondentEmail}${comment ? `: ${comment}` : ''}`
          : comment ? `Approved via email: ${comment}` : 'Approved via email link',
      });

      if (variation.requestor_email) {
        await notifyPM({
          toEmail: variation.requestor_email,
          varRef, projectName,
          action: 'approved',
          comment,
          variationId: variation.id,
          respondentEmail: bodyRespondentEmail ?? undefined,
        });
      }

      if (bodyRespondentEmail) {
        await notifyApprover({
          toEmail: bodyRespondentEmail,
          varRef, projectName,
          action: 'approved',
          comment,
          variationId: variation.id,
          title: (variation as any).title ?? undefined,
          estimatedValue: (variation as any).estimated_value ?? null,
        });
      }

      return NextResponse.json({ ok: true });
    }

    // Default: reject
    await supabase
      .from('variations')
      .update({
        status: 'disputed',
        client_approval_response: 'rejected',
        client_approval_comment: comment || null,
        client_approved_at: new Date().toISOString(),
        client_approved_by_email: bodyRespondentEmail ?? null,
      })
      .eq('approval_token', token);

    await supabase.from('status_changes').insert({
      variation_id: variation.id,
      from_status: variation.status,
      to_status: 'disputed',
      changed_by: 'client-email',
      note: bodyRespondentEmail
        ? `Rejected via email by ${bodyRespondentEmail}${comment ? `: ${comment}` : ''}`
        : comment ? `Rejected via email: ${comment}` : 'Rejected via email link',
    });

    // Email the PM
    if (variation.requestor_email) {
      await notifyPM({
        toEmail: variation.requestor_email,
        varRef, projectName,
        action: 'rejected',
        comment,
        variationId: variation.id,
        respondentEmail: bodyRespondentEmail ?? undefined,
      });
    }

    if (bodyRespondentEmail) {
      await notifyApprover({
        toEmail: bodyRespondentEmail,
        varRef, projectName,
        action: 'rejected',
        comment,
        variationId: variation.id,
        title: (variation as any).title ?? undefined,
        estimatedValue: (variation as any).estimated_value ?? null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[variation-response] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
