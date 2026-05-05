-- ============================================================
-- Migration: 047_fix_invitations_rls_token_lookup
-- Run via: Supabase Dashboard → SQL Editor → Run
-- Date: 2026-05-05
-- Fix: Invitation lookup for users who are not yet company members
-- ============================================================

BEGIN;

-- The invitations SELECT policy currently requires:
--   EXISTS (SELECT 1 FROM company_members WHERE user_id = auth.uid() ...)
-- This blocks invited users who are NOT yet members of the company.
-- The join flow needs to look up the invitation by token BEFORE accepting.
--
-- Fix: Allow SELECT when EITHER:
--   (a) User is an active company member, OR
--   (b) The invitation's email matches the authenticated user's email
--       (proof the invite was sent to this person)

DROP POLICY IF EXISTS "company_members_read_own_invitations" ON public.invitations;

CREATE POLICY "invitations_select_by_company_or_email"
ON public.invitations
FOR SELECT
USING (
  -- Condition A: user is an active member of the invitation's company
  EXISTS (
    SELECT 1 FROM public.company_members AS cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id = invitations.company_id
      AND cm.is_active = true
  )
  OR
  -- Condition B: invitation was sent to this user's email
  -- (allows invited person to read/accept their own invitation before joining)
  invitations.email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

COMMIT;

-- Verification:
-- 1. Create invitation for new email (not yet in company_members)
-- 2. Log in as that email address
-- 3. Visit /join?token=... — should now find the invitation and show the join form