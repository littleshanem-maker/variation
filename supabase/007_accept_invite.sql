-- Function to accept an invitation — runs as SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.accept_invitation(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  inv RECORD;
  new_member_id UUID;
BEGIN
  -- Find the invitation
  SELECT * INTO inv FROM public.invitations
  WHERE token = invite_token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid or expired invitation');
  END IF;

  -- Check the calling user matches the invited email
  IF inv.email != (SELECT email FROM auth.users WHERE id = auth.uid()) THEN
    RETURN json_build_object('error', 'This invitation is for a different email address');
  END IF;

  -- Check not already a member
  IF EXISTS (SELECT 1 FROM public.company_members WHERE company_id = inv.company_id AND user_id = auth.uid()) THEN
    -- Already a member, just mark invite accepted
    UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id;
    RETURN json_build_object('success', true, 'message', 'Already a member');
  END IF;

  -- Add as member
  INSERT INTO public.company_members (company_id, user_id, role, invited_by, accepted_at)
  VALUES (inv.company_id, auth.uid(), inv.role, inv.invited_by, now())
  RETURNING id INTO new_member_id;

  -- Mark invitation accepted
  UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id;

  RETURN json_build_object('success', true, 'member_id', new_member_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
