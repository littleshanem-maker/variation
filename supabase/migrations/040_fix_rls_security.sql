-- =============================================
-- MIGRATION: RLS Security Fixes — COMPLETE 2026-04-29
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- =============================================

-- =============================================
-- FIX 1: /dashboard middleware — PROTECT THE ROUTE
-- (Already pushed via git — Vercel is deploying now)
-- File: web/src/middleware.ts
-- Change: /dashboard now requires auth, redirects to /login if not logged in
-- Status: DEPLOYING via git push — check app.leveragedsystems.com.au in ~2 min
-- =============================================



-- =============================================
-- FIX 2: invitations table — anon can read ALL pending invitations
-- =============================================

-- Drop insecure anon SELECT policies
DROP POLICY IF EXISTS "Allow anonymous read of pending invitations" ON invitations;
DROP POLICY IF EXISTS "Anon can read pending invitations" ON invitations;
DROP POLICY IF EXISTS "Allow anon read invitations" ON invitations;
DROP POLICY IF EXISTS "Invitations anon read" ON invitations;
DROP POLICY IF EXISTS "Public read invitations" ON invitations;

-- Create company-scoped policy: users can only see invitations for their own company
DROP POLICY IF EXISTS "company_members_read_own_invitations" ON invitations;
CREATE POLICY "company_members_read_own_invitations"
ON invitations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.user_id = auth.uid()
    AND company_members.company_id = invitations.company_id
    AND company_members.is_active = true
  )
);

-- =============================================
-- FIX 3: waitlist table — anon can read all entries
-- =============================================

-- Drop insecure anon SELECT policies
DROP POLICY IF EXISTS "Allow anonymous read of waitlist" ON waitlist;
DROP POLICY IF EXISTS "Anon can read waitlist" ON waitlist;
DROP POLICY IF EXISTS "Allow anon read waitlist" ON waitlist;
DROP POLICY IF EXISTS "Public read waitlist" ON waitlist;

-- Create auth-required policy: only logged-in users can read waitlist
DROP POLICY IF EXISTS "authenticated_users_read_waitlist" ON waitlist;
CREATE POLICY "authenticated_users_read_waitlist"
ON waitlist
FOR SELECT
USING (auth.role() = 'authenticated');

-- =============================================
-- BONUS FIX: company_members — prevent anon profile enumeration
-- =============================================

DROP POLICY IF EXISTS "Allow anonymous read of company members" ON company_members;
DROP POLICY IF EXISTS "Anon can read members" ON company_members;
DROP POLICY IF EXISTS "Public read members" ON company_members;

CREATE POLICY "authenticated_users_read_own_company_members"
ON company_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM company_members AS cm2
    WHERE cm2.user_id = auth.uid()
    AND cm2.company_id = company_members.company_id
    AND cm2.is_active = true
  )
);

-- =============================================
-- Verify
-- =============================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename IN ('invitations', 'waitlist', 'company_members')
ORDER BY tablename, policyname;