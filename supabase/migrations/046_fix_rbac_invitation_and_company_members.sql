-- ============================================================
-- Migration: 046_fix_rbac_invitation_and_company_members
-- Run via: Supabase Dashboard → SQL Editor → Run
-- Date: 2026-05-05
-- ============================================================

BEGIN;

-- =============================================
-- FIX 1: accept_invitation — confirm role is read from invitation
-- =============================================
-- The function should already use inv.role (not hardcoded).
-- This re-applies the correct version as a belt-and-suspenders.
-- Key: INSERT uses invitation.role, not a hardcoded string.

CREATE OR REPLACE FUNCTION public.accept_invitation(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  inv RECORD;
  new_member_id UUID;
BEGIN
  -- Find the invitation
  SELECT id, company_id, email, role, invited_by INTO inv
  FROM public.invitations
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

  -- Check not already a member (upsert case)
  IF EXISTS (SELECT 1 FROM public.company_members WHERE company_id = inv.company_id AND user_id = auth.uid()) THEN
    UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id;
    RETURN json_build_object('success', true, 'message', 'Already a member');
  END IF;

  -- Add as member — USE THE INVITED ROLE, not hardcoded
  INSERT INTO public.company_members (company_id, user_id, role, invited_by, accepted_at)
  VALUES (inv.company_id, auth.uid(), inv.role, inv.invited_by, now())
  RETURNING id INTO new_member_id;

  -- Mark invitation accepted
  UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id;

  RETURN json_build_object('success', true, 'member_id', new_member_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =============================================
-- FIX 2: company_members SELECT — remove recursion
-- =============================================
-- The existing policy uses a self-join (EXISTS from company_members)
-- which causes infinite recursion detection in PostgreSQL RLS.
--
-- Fix: Use a SECURITY DEFINER helper that bypasses RLS,
-- then reference it in the policy (which itself uses SECURITY DEFINER STABLE).

DROP POLICY IF EXISTS "authenticated_users_read_own_company_members" ON company_members;

-- Helper function — runs as SECURITY DEFINER so RLS is bypassed on read.
-- STABLE means it doesn't modify state (safe for policy use).
CREATE OR REPLACE FUNCTION public.get_company_ids_for_user(p_user_id UUID)
RETURNS SETOF UUID AS $$
  SELECT company_id
  FROM public.company_members
  WHERE user_id = p_user_id AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Non-recursive policy: user can read company_members rows for companies they belong to.
-- Because get_company_ids_for_user is SECURITY DEFINER, it bypasses the company_members
-- RLS policy during evaluation — no recursion.
CREATE POLICY "company_members_select_own_company"
ON company_members
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT get_company_ids_for_user(auth.uid())
  )
);

-- =============================================
-- Verify FIX 1: role assignment
-- =============================================
-- After accepting a field invitation:
--   SELECT role FROM company_members WHERE user_id = <new_user>;
-- Should return 'field', not 'office'.

-- =============================================
-- Verify FIX 2: no recursion error
-- =============================================
-- Run this as any authenticated user:
--   SELECT id, company_id, role FROM company_members LIMIT 5;
-- Should return rows without "infinite recursion" error.

COMMIT;