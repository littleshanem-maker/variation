-- Admin function to update a member's role
CREATE OR REPLACE FUNCTION public.update_member_role(member_id UUID, new_role TEXT)
RETURNS JSON AS $$
DECLARE
  target RECORD;
BEGIN
  -- Get the target member
  SELECT * INTO target FROM public.company_members WHERE id = member_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Member not found');
  END IF;

  -- Check caller is admin of the same company
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = target.company_id
    AND user_id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  ) THEN
    RETURN json_build_object('error', 'Only admins can change roles');
  END IF;

  -- Validate role
  IF new_role NOT IN ('admin', 'office', 'field') THEN
    RETURN json_build_object('error', 'Invalid role');
  END IF;

  UPDATE public.company_members SET role = new_role WHERE id = member_id;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin function to deactivate a member
CREATE OR REPLACE FUNCTION public.remove_member(member_id UUID)
RETURNS JSON AS $$
DECLARE
  target RECORD;
BEGIN
  SELECT * INTO target FROM public.company_members WHERE id = member_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Member not found');
  END IF;

  -- Check caller is admin of the same company
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = target.company_id
    AND user_id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  ) THEN
    RETURN json_build_object('error', 'Only admins can remove members');
  END IF;

  -- Don't allow removing yourself
  IF target.user_id = auth.uid() THEN
    RETURN json_build_object('error', 'Cannot remove yourself');
  END IF;

  UPDATE public.company_members SET is_active = false WHERE id = member_id;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(UUID) TO authenticated;
