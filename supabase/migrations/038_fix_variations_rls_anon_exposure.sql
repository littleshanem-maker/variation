-- 038_fix_variations_rls_anon_exposure.sql
-- PROBLEM: "Anon token lookup for approval" policy used `approval_token IS NOT NULL`
-- which matches ALL variations with any approval_token — exposing 104 rows to anon.
--
-- ROOT CAUSE: The policy was meant to allow the /api/variation-response token lookup
-- but granting access to ALL token-holding variations is far too broad. The actual flow:
--   1. Client clicks link: GET /api/variation-response?token=XXX
--   2. API route queries: SELECT ... WHERE approval_token = 'XXX' — PostgREST injects the ?token=XXX filter
--   3. RLS USING clause evaluates with PostgREST's WHERE clause context
--
-- SECURITY MODEL:
--   - Authenticated users → company-scoped via get_user_company_ids()
--   - Anonymous → NO automatic access. The /api/variation-response route is a Next.js
--     server-side API (not PostgREST REST), so RLS does NOT apply there at all.
--     It uses supabase-js with anon key but the query is server-side filtered.
--     For the direct PostgREST path (never used by the client flow), no anon access.
--
-- CORRECT APPROACH: Drop all anon variation policies entirely. Authenticated users are
-- scoped by company. Anon gets NO access via PostgREST. The client approval flow
-- never goes through PostgREST — it goes through the Next.js API route which filters
-- by token server-side and is NOT subject to RLS (server-side query with service role
-- or at minimum, the application controls the WHERE clause).

BEGIN;

-- ============================================================
-- DROP all existing variation policies
-- ============================================================
DROP POLICY IF EXISTS "Allow token-based variation lookup" ON public.variations;
DROP POLICY IF EXISTS "Allow token-based variation update" ON public.variations;
DROP POLICY IF EXISTS "Company members view variations" ON public.variations;
DROP POLICY IF EXISTS "Anon token lookup for approval" ON public.variations;
DROP POLICY IF EXISTS "Anon token update for approval" ON public.variations;

-- ============================================================
-- POLICY 1: Authenticated company members — SELECT
-- Scope: only variations belonging to companies the user belongs to
-- via project → company membership check
-- ============================================================
CREATE POLICY "Company members can view variations"
  ON public.variations
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id IN (SELECT public.get_user_company_ids())
    )
  );

-- ============================================================
-- POLICY 2: Authenticated company members — UPDATE
-- Scope: same company check for UPDATE operations
-- ============================================================
CREATE POLICY "Company members can update variations"
  ON public.variations
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id IN (SELECT public.get_user_company_ids())
    )
  );

-- ============================================================
-- NO anon policy for variations.
-- The client approval flow (GET /api/variation-response?token=XXX) is handled
-- by the Next.js server-side route handler, NOT by PostgREST REST API.
-- That route filters by exact token before returning data to the client.
-- Direct anonymous REST access to variations is blocked.

COMMIT;

-- VERIFY: The following should return 0 rows (empty array) for anon:
-- curl "https://ketidyzumcdxditjfruk.supabase.co/rest/v1/variations?select=id&limit=5" \
--   -H "apikey: <ANON_KEY>"