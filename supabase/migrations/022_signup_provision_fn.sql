-- Migration 022: Signup provisioning function
-- Creates a SECURITY DEFINER function to handle new account setup
-- Bypasses RLS to allow new users to create their own company + membership
-- Called from the /signup page after auth user creation

CREATE OR REPLACE FUNCTION public.provision_new_account(
  p_company_id UUID,
  p_company_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the calling user's ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Prevent duplicate provisioning
  IF EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = v_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User already has a company';
  END IF;

  -- Create company
  INSERT INTO public.companies (id, name, created_at)
  VALUES (p_company_id, p_company_name, NOW());

  -- Create admin membership
  INSERT INTO public.company_members (
    id, company_id, user_id, role, is_active, invited_at, accepted_at
  )
  VALUES (
    gen_random_uuid(),
    p_company_id,
    v_user_id,
    'admin',
    true,
    NOW(),
    NOW()
  );
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.provision_new_account(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_new_account(UUID, TEXT) TO authenticated;
