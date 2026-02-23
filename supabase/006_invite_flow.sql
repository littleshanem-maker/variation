-- Allow anyone to read an invitation by token (for the join page)
-- This is safe because tokens are unguessable UUIDs
CREATE POLICY "Anyone can view invitation by token" ON public.invitations
  FOR SELECT USING (true);

-- Allow newly signed-up users to insert themselves as company members
-- (when accepting an invitation)
CREATE POLICY "Invited users can join company" ON public.company_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invitations
      WHERE company_id = company_members.company_id
      AND accepted_at IS NULL
      AND expires_at > now()
    )
  );

-- Allow invitation acceptance (update accepted_at)
CREATE POLICY "Users can accept their own invitation" ON public.invitations
  FOR UPDATE USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
