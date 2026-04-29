-- 040_fix_company_members_select_recursion.sql
-- FIX: company_members SELECT recursion
--
-- Problem observed in production:
--   SELECT ... FROM public.company_members WHERE user_id = auth.uid()
-- can fail with: "infinite recursion detected in policy for relation \"company_members\"".
--
-- Root cause:
--   The older SELECT policy "Members see own company members" checks:
--     company_id IN (SELECT public.get_user_company_ids())
--   and get_user_company_ids() reads public.company_members again. When that policy is
--   evaluated while selecting from company_members, Postgres can recurse into the same
--   relation policy.
--
-- Safe rollout approach:
--   - Keep direct self-membership lookup for app role/bootstrap logic.
--   - Remove the recursive same-table SELECT policy.
--   - Leave broader member-directory/admin functionality to dedicated RPC/server-side
--     code instead of broad client SELECT on company_members.
--
-- This is intentionally narrow and additive-safe for live pilots.

BEGIN;

-- Ensure the helper is still safe for other table policies (companies/projects/etc).
CREATE OR REPLACE FUNCTION public.get_user_company_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT company_id
  FROM public.company_members
  WHERE user_id = auth.uid()
    AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_user_role(p_company_id UUID)
RETURNS TEXT AS $$
  SELECT role
  FROM public.company_members
  WHERE user_id = auth.uid()
    AND company_id = p_company_id
    AND is_active = true
  ORDER BY CASE role WHEN 'admin' THEN 3 WHEN 'office' THEN 2 WHEN 'field' THEN 1 ELSE 0 END DESC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- Drop the recursive SELECT policy on company_members.
DROP POLICY IF EXISTS "Members see own company members" ON public.company_members;

-- Keep/replace the non-recursive policy needed for the current user's membership lookup.
DROP POLICY IF EXISTS "Users see own memberships" ON public.company_members;
CREATE POLICY "Users see own memberships"
  ON public.company_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_active = true);

COMMIT;

-- Verification after applying:
-- 1. Log in as any normal user and run the app role lookup.
-- 2. This should no longer error:
--    SELECT id, company_id, role, is_active
--    FROM public.company_members
--    WHERE user_id = auth.uid() AND is_active = true;
