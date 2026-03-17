-- 026_approval_token_rls.sql
-- Allow unauthenticated reads on variations by approval_token
-- This is required for the /api/variation-response server route to work
-- without a user session (client clicking approve/reject from email)

-- Allow anyone to SELECT a variation by its approval_token (token is effectively a secret URL)
CREATE POLICY "Allow token-based variation lookup"
  ON public.variations
  FOR SELECT
  USING (approval_token IS NOT NULL);

-- Allow anyone to UPDATE a variation by its approval_token (approve/reject action)
CREATE POLICY "Allow token-based variation update"
  ON public.variations
  FOR UPDATE
  USING (approval_token IS NOT NULL);
