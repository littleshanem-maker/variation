-- 018_fix_duplicate_company_ids.sql
-- Redefine get_user_company_ids() to return DISTINCT values
-- Prevents duplicate project rows appearing when a user has multiple company_members rows.
-- Apply via Supabase Dashboard → SQL Editor → Run

CREATE OR REPLACE FUNCTION public.get_user_company_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT company_id FROM public.company_members
  WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';
