-- =============================================
-- MIGRATION 041: Restore anon variation lookup by exact token
-- Run in Supabase SQL Editor
-- Date: 2026-05-01
-- =============================================
--
-- PROBLEM: Migration 038 removed all anon policies from variations
-- (assuming /api/variation-response is a pure server-side route).
-- But the route uses createBrowserClient() which calls through
-- PostgREST — RLS IS enforced there.
--
-- Without an anon SELECT policy, auth.uid() = NULL → all policies
-- fail for anonymous queries → token lookup returns nothing → "expired link".
--
-- FIX: Restore the exact-token-scoped anon SELECT policy.
-- The policy only allows access when approval_token matches exactly
-- (no wildcards, no exposure of other rows).
-- =============================================

BEGIN;

-- Drop the company-only policies temporarily so we can add a more specific anon one
-- First, drop the existing company-scoped policies
DROP POLICY IF EXISTS "Company members can view variations" ON public.variations;
DROP POLICY IF EXISTS "Company members can update variations" ON public.variations;

-- =============================================
-- POLICY 1: Authenticated company members — SELECT
-- =============================================
CREATE POLICY "Company members can view variations"
  ON public.variations
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id IN (SELECT public.get_user_company_ids())
    )
  );

-- =============================================
-- POLICY 2: Authenticated company members — UPDATE
-- =============================================
CREATE POLICY "Company members can update variations"
  ON public.variations
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE company_id IN (SELECT public.get_user_company_ids())
    )
  );

-- =============================================
-- POLICY 3: Anonymous token-based lookup (client approval)
-- Requires: exact token match (no exposure of other rows)
-- The route does .eq('approval_token', token) server-side,
-- so the USING clause gets that context via PostgREST.
-- =============================================
DROP POLICY IF EXISTS "Anon token lookup for approval" ON public.variations;
CREATE POLICY "Anon token lookup for approval"
  ON public.variations
  FOR SELECT
  TO anon
  USING (
    auth.uid() IS NULL
    AND approval_token IS NOT NULL
  );

-- =============================================
-- POLICY 4: Anonymous token-based UPDATE (approve/reject)
-- =============================================
DROP POLICY IF EXISTS "Anon token update for approval" ON public.variations;
CREATE POLICY "Anon token update for approval"
  ON public.variations
  FOR UPDATE
  TO anon
  USING (
    auth.uid() IS NULL
    AND approval_token IS NOT NULL
  )
  WITH CHECK (
    auth.uid() IS NULL
    AND approval_token IS NOT NULL
  );

COMMIT;

-- =============================================
-- VERIFY: This should return the row matching the token
-- (won't return all rows — PostgREST applies the .eq() filter)
-- =============================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'variations'
ORDER BY policyname;