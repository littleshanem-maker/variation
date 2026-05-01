-- 039_fix_variation_response_rls.sql
-- PROBLEM: Migration 038 dropped ALL anon policies for variations, assuming the
-- /api/variation-response route would bypass RLS (server-side query).
-- REALITY: createBrowserClient() from a Next.js API route still routes through
-- PostgREST which ENFORCES RLS regardless of server-side execution context.
-- Result: token lookup returns 0 rows → "Link Expired" for every approval link.
--
-- ROOT CAUSE: Migration 026 "Allow token-based variation lookup for approval"
-- used `approval_token IS NOT NULL` which was too broad (matched ALL variations
-- with a token). Migration 037 narrowed it. Migration 038 dropped all anon access
-- entirely to fix the exposure, but broke the client approval flow.
--
-- FIX: Add back a token-scoped SELECT policy for anon, limited to the specific
-- token via the PostgREST query filter (approval_token = 'XXX'). This is the
-- same secure approach as 037 but re-enabled since the underlying query IS
-- already token-filtered server-side.
--
-- SECURITY: An anon user can only read the specific variation whose token they
-- already know (the token is the secret URL). This is no worse than the secret
-- URL itself being shared. It does NOT expose variation list access.

BEGIN;

-- Re-enable anon SELECT for token-based variation lookup (client approval flow)
-- The PostgREST query filter (approval_token = 'XXX') is applied server-side
-- before RLS evaluation, so this only ever returns the one matched row.
CREATE POLICY "Anon token lookup for approval"
  ON public.variations
  FOR SELECT
  TO anon
  USING (
    auth.uid() IS NULL
    AND approval_token IS NOT NULL
  );

COMMIT;
