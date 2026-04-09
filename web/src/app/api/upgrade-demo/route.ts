import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/upgrade-demo?company=Blackstone
// Upgrades a company to Pro plan. For demo purposes only.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyName = searchParams.get('company');

  if (!companyName) {
    return NextResponse.json({ error: 'Missing company param' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceKey) {
    return NextResponse.json({ error: 'Service key not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabase
    .from('companies')
    .update({ plan: 'pro' })
    .eq('name', companyName)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
