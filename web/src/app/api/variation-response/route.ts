import { NextRequest, NextResponse } from 'next/server';
import { createClient as createBrowserClient } from '@/lib/supabase';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.leveragedsystems.com.au';

async function sendTelegramNotification(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
  } catch {
    // Never block response on notification failure
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

  // Look up variation by token
  const { data: variation, error } = await supabase
    .from('variations')
    .select('id, variation_number, sequence_number, status, approval_token_expires_at, client_approval_response, projects(name, client)')
    .eq('approval_token', token)
    .single();

  if (error || !variation) {
    return NextResponse.redirect(`${APP_URL}/variation-response/expired`);
  }

  // Check expiry
  const expiresAt = variation.approval_token_expires_at ? new Date(variation.approval_token_expires_at) : null;
  if (expiresAt && expiresAt < new Date()) {
    return NextResponse.redirect(`${APP_URL}/variation-response/expired`);
  }

  const varRef = variation.variation_number ?? `VAR-${String(variation.sequence_number).padStart(3, '0')}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proj = Array.isArray(variation.projects) ? (variation.projects as any[])[0] : (variation.projects as any);

  if (action === 'approve') {
    // Update variation immediately
    await supabase
      .from('variations')
      .update({
        status: 'approved',
        client_approval_response: 'approved',
        client_approved_at: new Date().toISOString(),
      })
      .eq('approval_token', token);

    // Log status change
    await supabase.from('status_changes').insert({
      variation_id: variation.id,
      from_status: variation.status,
      to_status: 'approved',
      changed_by: 'client-email',
      note: 'Approved via email link',
    });

    // Notify Shane
    const projectName = proj?.name ?? 'Unknown Project';
    const clientName = proj?.client ?? '';
    await sendTelegramNotification(
      `✅ ${varRef} approved by client\n${projectName}${clientName ? ` (${clientName})` : ''}`
    );

    return NextResponse.redirect(`${APP_URL}/variation-response/approved?ref=${encodeURIComponent(varRef)}`);
  }

  if (action === 'reject') {
    // Redirect to reject form page (needs a comment)
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
      .select('id, variation_number, sequence_number, status, approval_token_expires_at, projects(name, client)')
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj = Array.isArray(variation.projects) ? (variation.projects as any[])[0] : (variation.projects as any);

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

    const projectName = proj?.name ?? 'Unknown Project';
    const clientName = proj?.client ?? '';
    await sendTelegramNotification(
      `❌ ${varRef} rejected by client\n${projectName}${clientName ? ` (${clientName})` : ''}${comment ? `\nReason: "${comment}"` : ''}`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[variation-response] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
