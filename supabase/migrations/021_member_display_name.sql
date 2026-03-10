-- Migration 021: Add display_name to company_members
-- Allows admins to set a display name override for team members
-- without needing to touch auth.users directly

ALTER TABLE public.company_members
  ADD COLUMN IF NOT EXISTS display_name TEXT;
