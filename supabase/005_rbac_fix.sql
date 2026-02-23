-- Fix: Add direct self-lookup policy for company_members
-- The existing policy uses get_user_company_ids() which should work via SECURITY DEFINER,
-- but adding a direct policy as belt-and-suspenders.
CREATE POLICY "Users see own memberships" ON public.company_members
  FOR SELECT USING (user_id = auth.uid());

-- Also ensure the companies INSERT policy exists for creating companies on signup
CREATE POLICY "Authenticated users can create companies" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
