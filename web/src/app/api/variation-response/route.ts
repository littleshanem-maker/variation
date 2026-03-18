import { NextRequest, NextResponse } from 'next/server';
import { createClient as createBrowserClient } from '@/lib/supabase';
import { Resend } from 'resend';

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
}) {
  const { toEmail, varRef, projectName, action, comment, variationId } = opts;
  if (!toEmail || !process.env.RESEND_API_KEY) return;

  const subject = action === 'approved'
    ? `✅ ${varRef} approved by client — ${projectName}`
    : `❌ ${varRef} rejected by client — ${projectName}`;

  const bodyHtml = action === 'approved'
    ? `<p>Good news — <strong>${varRef}</strong> has been <strong style="color:#16a34a;">approved by the client</strong> via the email link.</p>
       <p>Project: ${projectName}</p>
       <p><a href="${APP_URL}/variation/${variationId}" style="color:#4f46e5;">View variation →</a></p>
       <p style="color:#6b7280;font-size:12px;">Log in to mark as paid when the invoice is raised.</p>`
    : `<p><strong>${varRef}</strong> has been <strong style="color:#dc2626;">rejected by the client</strong> via the email link.</p>
       <p>Project: ${projectName}</p>
       ${comment ? `<p>Reason: <em>"${comment}"</em></p>` : ''}
       <p><a href="${APP_URL}/variation/${variationId}" style="color:#4f46e5;">View variation →</a></p>
       <p style="color:#6b7280;font-size:12px;">Log in to revise and resubmit.</p>`;

  try {
    await resend.emails.send({
      from: `Variation Shield <noreply@${FROM_DOMAIN}>`,
      to: toEmail,
      subject,
      html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px;">${bodyHtml}</body></html>`,
    });
  } catch (err) {
    console.error('[variation-response] PM notify error:', err);
  }
}

// GET: Handle approve (direct redirect) or reject (show form)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action');

  if (!token || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.redirect(`${APP_URL}/variation-response/expired`);
  }

  const supabase = createBrowserClient();

  const { data: variation, error } = await supabase
    .from('variations')
    .select('id, variation_number, sequence_number, status, approval_token_expires_at, client_approval_response, requestor_email, project_id')
    .eq('approval_token', token)
    .single();

  if (error || !variation) {
    return NextResponse.redirect(`${APP_URL}/variation-response/expired`);
  }

  const expiresAt = variation.approval_token_expires_at ? new Date(variation.approval_token_expires_at) : null;
  if (expiresAt && expiresAt < new Date()) {
    return NextResponse.redirect(`${APP_URL}/variation-response/expired`);
  }

  const varRef = variation.variation_number ?? `VAR-${String(variation.sequence_number).padStart(3, '0')}`;
  const projectName = 'Project';

  if (action === 'approve') {
    await supabase
      .from('variations')
      .update({
        status: 'approved',
        client_approval_response: 'approved',
        client_approved_at: new Date().toISOString(),
      })
      .eq('approval_token', token);

    await supabase.from('status_changes').insert({
      variation_id: variation.id,
      from_status: variation.status,
      to_status: 'approved',
      changed_by: 'client-email',
      note: 'Approved via email link',
    });

    // Email the PM
    if (variation.requestor_email) {
      await notifyPM({
        toEmail: variation.requestor_email,
        varRef, projectName,
        action: 'approved',
        variationId: variation.id,
      });
    }

    return NextResponse.redirect(`${APP_URL}/variation-response/approved?ref=${encodeURIComponent(varRef)}`);
  }

  if (action === 'reject') {
    return NextResponse.redirect(
      `${APP_URL}/variation-response/reject?token=${token}&ref=${encodeURIComponent(varRef)}`
    );
  }

  return NextResponse.redirect(`${APP_URL}/variation-response/expired`);
}

// POST: Handle reject form submission
export async function POST(req: NextRequest) {
  try {
    const { token, comment } = await req.json() as { token: string; comment?: string };

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const supabase = createBrowserClient();

    const { data: variation, error } = await supabase
      .from('variations')
      .select('id, variation_number, sequence_number, status, approval_token_expires_at, requestor_email, project_id')
      .eq('approval_token', token)
      .single();

    if (error || !variation) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    const expiresAt = variation.approval_token_expires_at ? new Date(variation.approval_token_expires_at) : null;
    if (expiresAt && expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 410 });
    }

    const varRef = variation.variation_number ?? `VAR-${String(variation.sequence_number).padStart(3, '0')}`;
    const projectName = 'Project';

    await supabase
      .from('variations')
      .update({
        status: 'disputed',
        client_approval_response: 'rejected',
        client_approval_comment: comment || null,
        client_approved_at: new Date().toISOString(),
      })
      .eq('approval_token', token);

    await supabase.from('status_changes').insert({
      variation_id: variation.id,
      from_status: variation.status,
      to_status: 'disputed',
      changed_by: 'client-email',
      note: comment ? `Rejected via email: ${comment}` : 'Rejected via email link',
    });

    // Email the PM
    if (variation.requestor_email) {
      await notifyPM({
        toEmail: variation.requestor_email,
        varRef, projectName,
        action: 'rejected',
        comment,
        variationId: variation.id,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[variation-response] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
