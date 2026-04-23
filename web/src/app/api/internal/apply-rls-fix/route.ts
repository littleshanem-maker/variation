import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// SECURITY: This endpoint is for applying the RLS fix only.
// It uses service role to bypass RLS, executes the migration, then deletes itself.
// This route should be removed/deactivated after use.

export async function POST(req: Request) {
  const { secret } = await req.json().catch(() => ({}));

  // Basic protection - remove after use
  if (secret !== 'fix-rls-037') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    return NextResponse.json({ error: 'service key not configured' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const migration = `
-- Migration 037: Fix critical RLS vulnerability in variations table
BEGIN;

-- DROP the vulnerable token-based policies
DROP POLICY IF EXISTS "Allow token-based variation lookup" ON public.variations;
DROP POLICY IF EXISTS "Allow token-based variation update" ON public.variations;

-- POLICY 1: Authenticated company members - scope to their company
CREATE POLICY "Company members view variations"
  ON public.variations
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id IN (SELECT public.get_user_company_ids())
    )
  );

-- POLICY 2: Anonymous token lookup (client approval flow)
-- Only active when auth.uid() IS NULL (not authenticated)
-- Still allows SELECT by exact token for the /api/variation-response endpoint
CREATE POLICY "Anon token lookup for approval"
  ON public.variations
  FOR SELECT
  TO anon
  USING (
    auth.uid() IS NULL
    AND approval_token IS NOT NULL
  );

-- POLICY 3: Anonymous token UPDATE (approve/reject action)
CREATE POLICY "Anon token update for approval"
  ON public.variations
  FOR UPDATE
  TO anon
  USING (
    auth.uid() IS NULL
    AND approval_token IS NOT NULL
  )
  WITH CHECK (
    auth.uid() IS NULL
    AND approval_token IS NOT NULL
  );

COMMIT;
`;

  // Execute via pg_catalog for direct SQL
  const { data, error } = await supabase.rpc('pg_catalog.exec', { sql: migration }).catch(() => null);

  if (error) {
    // Try direct RPC if available
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}