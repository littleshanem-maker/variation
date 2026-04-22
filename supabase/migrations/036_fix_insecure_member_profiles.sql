-- Migration 036: Fix critical security vulnerability in public.member_profiles view
-- Date: 2026-04-22
-- Problem: public.member_profiles was exposing email addresses and full names of ALL users
--          across ALL companies to anyone with the anon key. No RLS policies.
-- Fix: Drop the insecure view and recreate with proper RLS using auth.uid() filtering.
--       Also apply RLS to mission_store and waitlist tables.

BEGIN;

-- ============================================================
-- 1. DROP the insecure member_profiles view
-- ============================================================
DROP VIEW IF EXISTS public.member_profiles;

-- ============================================================
-- 2. Recreate member_profiles as a SECURE view with RLS
--    using auth.uid() to filter to the caller's own company
-- ============================================================
CREATE OR REPLACE VIEW public.member_profiles AS
SELECT
  cm.id,
  cm.company_id,
  cm.role,
  cm.is_active,
  cm.invited_at,
  cm.accepted_at,
  -- Only show profile fields for users in the same company as the caller
  CASE
    WHEN cm.company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    THEN au.email
    ELSE NULL
  END AS email,
  CASE
    WHEN cm.company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
    THEN au.raw_user_meta_data->>'full_name'
    ELSE NULL
  END AS full_name
FROM public.company_members cm
JOIN auth.users au ON au.id = cm.user_id;

-- Enable RLS on the view
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Users can view member profiles in their company" ON public.member_profiles;
DROP POLICY IF EXISTS "Authenticated users can view their own member profile" ON public.member_profiles;

-- Policy: users can only see member profiles within their own company
CREATE POLICY "Users can view member profiles in their company"
  ON public.member_profiles
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============================================================
-- 3. Apply RLS to mission_store if table exists and RLS is missing
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mission_store') THEN
    -- Check if RLS is already enabled
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'mission_store') THEN
      ALTER TABLE public.mission_store ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Drop existing policies if any (idempotent)
    DROP POLICY IF EXISTS "Company members can manage mission store" ON public.mission_store;
    DROP POLICY IF EXISTS "Authenticated users can view mission store" ON public.mission_store;

    -- Allow company members to manage mission_store rows for their company
    CREATE POLICY "Company members can manage mission store"
      ON public.mission_store
      FOR ALL
      USING (
        company_id IN (
          SELECT company_id FROM public.company_members
          WHERE user_id = auth.uid() AND is_active = true
        )
      );
  END IF;
END $$;

-- ============================================================
-- 4. Apply RLS to waitlist if table exists and RLS is missing
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waitlist') THEN
    -- Check if RLS is already enabled
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'waitlist') THEN
      ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
    END IF;

    -- Drop existing policies if any (idempotent)
    DROP POLICY IF EXISTS "Public can view waitlist" ON public.waitlist;
    DROP POLICY IF EXISTS "Authenticated users can manage waitlist" ON public.waitlist;

    -- Only allow users to see/manage their own waitlist entry
    CREATE POLICY "Users can manage their own waitlist entry"
      ON public.waitlist
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
