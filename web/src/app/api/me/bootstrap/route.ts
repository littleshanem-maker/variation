import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const roleRank: Record<string, number> = { admin: 3, office: 2, field: 1 };

type MemberRow = {
  id: string;
  company_id: string;
  user_id: string;
  role: 'admin' | 'office' | 'field';
  is_active: boolean;
  invited_at: string;
  accepted_at: string | null;
};

type CompanyRow = {
  id: string;
  name: string;
  abn?: string | null;
  address?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  plan?: 'free' | 'pro' | null;
  variation_count?: number | null;
  variation_limit?: number | null;
  project_limit?: number | null;
  upgraded_at?: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET() {
  const cookieStore = await cookies();

  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    return NextResponse.json({ error: 'Server membership lookup not configured' }, { status: 500 });
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: memberRows, error: memberError } = await admin
    .from('company_members')
    .select('id, company_id, user_id, role, is_active, invited_at, accepted_at')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const bestByCompany = new Map<string, MemberRow>();
  for (const member of memberRows || []) {
    const existing = bestByCompany.get(member.company_id);
    if (!existing || (roleRank[member.role] ?? 0) > (roleRank[existing.role] ?? 0)) {
      bestByCompany.set(member.company_id, member);
    }
  }

  const members = [...bestByCompany.values()].sort(
    (a, b) => (roleRank[b.role] ?? 0) - (roleRank[a.role] ?? 0)
  );

  const companyIds = members.map(m => m.company_id);
  const { data: companies, error: companyError } = companyIds.length > 0
    ? await admin
        .from('companies')
        .select('id, name, abn, address, phone, logo_url, plan, variation_count, variation_limit, project_limit, upgraded_at, created_at, updated_at')
        .in('id', companyIds)
    : { data: [], error: null };

  if (companyError) {
    return NextResponse.json({ error: companyError.message }, { status: 500 });
  }

  const companyMap = new Map((companies || []).map((company: CompanyRow) => [company.id, company]));
  const memberships = members.map(member => ({
    ...member,
    company: companyMap.get(member.company_id) || null,
  }));

  return NextResponse.json({
    userId: user.id,
    memberships,
    activeCompanyId: memberships[0]?.company_id ?? null,
  });
}
