-- Migration 013: Add missing DELETE policies for variations and variation_notices
-- Root cause: DELETE was silently blocked by RLS; UI swallowed the error.
-- Fix: Allow admin and office roles to delete variations and notices within their company.

-- VARIATIONS — admin and office can delete (field users cannot)
CREATE POLICY "Office/admin delete variations" ON public.variations
  FOR DELETE USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.company_id IN (SELECT public.get_user_company_ids())
      AND public.get_user_role(p.company_id) IN ('admin', 'office')
    )
  );

-- VARIATION NOTICES — admin and office can delete
CREATE POLICY "Office and admin can delete notices" ON public.variation_notices
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
