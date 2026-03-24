import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

// Stripe webhook handler — upgrades free → pro on checkout.session.completed
// Requires STRIPE_WEBHOOK_SECRET env var set in Vercel (add via dashboard)
// SUPABASE_SERVICE_ROLE_KEY must also be set in Vercel env vars

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  // Verify Stripe signature if webhook secret is configured
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret && signature) {
    try {
      // Manual HMAC verification (avoids needing the stripe npm package)
      const crypto = await import('crypto');
      const parts = signature.split(',').reduce((acc: Record<string, string>, part) => {
        const [k, v] = part.split('=');
        acc[k] = v;
        return acc;
      }, {});

      const timestamp = parts['t'];
      const receivedSig = parts['v1'];

      if (!timestamp || !receivedSig) {
        return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 });
      }

      const signedPayload = `${timestamp}.${rawBody}`;
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(signedPayload)
        .digest('hex');

      if (expectedSig !== receivedSig) {
        console.error('[stripe-webhook] Signature mismatch');
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
      }
    } catch (err) {
      console.error('[stripe-webhook] Signature verification error:', err);
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }
  } else if (webhookSecret && !signature) {
    // Secret configured but no signature — reject
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }
  // If no STRIPE_WEBHOOK_SECRET configured, skip verification (dev/testing only)

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only handle checkout.session.completed
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object;
  if (!session) {
    return NextResponse.json({ error: 'No session data' }, { status: 400 });
  }

  // Get customer email
  const customerEmail = session.customer_email || session.customer_details?.email;
  if (!customerEmail) {
    console.error('[stripe-webhook] No customer email in session:', session.id);
    return NextResponse.json({ error: 'No customer email' }, { status: 400 });
  }

  // Use service role to bypass RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    console.error('[stripe-webhook] SUPABASE_SERVICE_ROLE_KEY not configured');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Find user by email in auth.users
  const { data: usersData, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) {
    console.error('[stripe-webhook] Failed to list users:', userErr);
    return NextResponse.json({ error: 'Failed to query users' }, { status: 500 });
  }

  const matchedUser = usersData?.users?.find(
    (u: any) => u.email?.toLowerCase() === customerEmail.toLowerCase()
  );

  if (!matchedUser) {
    console.log('[stripe-webhook] No user found for email:', customerEmail, '— may need to create account');
    // User may not have created an account yet — log and return OK
    // They'll sign up at /signup?paid=true and the provision function will set them up
    return NextResponse.json({ received: true, note: 'No matching user account found' });
  }

  // Find the company for this user
  const { data: memberData, error: memberErr } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', matchedUser.id)
    .eq('is_active', true)
    .single();

  if (memberErr || !memberData) {
    console.error('[stripe-webhook] No company member found for user:', matchedUser.id);
    return NextResponse.json({ received: true, note: 'No company found for user' });
  }

  // Upgrade company to pro
  const { error: upgradeErr } = await supabase
    .from('companies')
    .update({
      plan: 'pro',
      variation_limit: null,
      project_limit: null,
      upgraded_at: new Date().toISOString(),
    })
    .eq('id', memberData.company_id);

  if (upgradeErr) {
    console.error('[stripe-webhook] Failed to upgrade company:', upgradeErr);
    return NextResponse.json({ error: 'Failed to upgrade company' }, { status: 500 });
  }

  console.log(`[stripe-webhook] Upgraded company ${memberData.company_id} to pro for ${customerEmail}`);
  return NextResponse.json({ received: true, upgraded: true, companyId: memberData.company_id });
}
