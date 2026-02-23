-- Function to get company members with emails
-- Runs as SECURITY DEFINER to access auth.users
CREATE OR REPLACE FUNCTION public.get_company_members(p_company_id UUID)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  user_id UUID,
  role TEXT,
  is_active BOOLEAN,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  email TEXT,
  full_name TEXT
) AS $$
BEGIN
  -- Only allow if caller is a member of this company
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = p_company_id
    AND company_members.user_id = auth.uid()
    AND company_members.is_active = true
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cm.id,
    cm.company_id,
    cm.user_id,
    cm.role,
    cm.is_active,
    cm.invited_at,
    cm.accepted_at,
    u.email,
    u.raw_user_meta_data->>'full_name' as full_name
  FROM public.company_members cm
  JOIN auth.users u ON u.id = cm.user_id
  WHERE cm.company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
