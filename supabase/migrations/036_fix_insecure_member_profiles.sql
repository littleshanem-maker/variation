-- Migration 036: Fix critical security vulnerability in public.member_profiles view
-- Date: 2026-04-22
-- Problem: public.member_profiles was exposing email addresses and full names of ALL users
--          across ALL companies to anyone with the anon key. No RLS policies.
-- Fix: Drop the insecure view and recreate with proper RLS using auth.uid() filtering.
-- NOTE: mission_store and waitlist are NOT included — mission_store contains only internal
--       ops data (single "latest" row), and waitlist has no PII requiring RLS protection
--       in this context (early-stage product waitlist, intentionally public-facing).

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

COMMIT;
