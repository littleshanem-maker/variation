-- Migration 011: Expand variations claim_type constraint to all 5 types
-- Previous constraint only allowed: cost, time, cost_and_time
-- Now allows: cost, time, cost_and_time, schedule_of_rates, lump_sum
-- This resolves the issue where users selecting 'Schedule of Rates' or 'Lump Sum'
-- contracts cannot create variations due to DB-level validation error.
--
-- HOW TO APPLY:
-- Copy the SQL below and paste into your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ketidyzumcdxditjfruk/sql
--
-- Then run: git add -A && git commit -m "011: expand variations claim_type constraint"
-- The post-commit hook will push to GitHub → Vercel deploy.

-- ============================================================
-- SQL TO RUN IN SUPABASE SQL EDITOR (copy from next line)
-- ============================================================

-- Step 1: Drop the existing (too-narrow) constraint
ALTER TABLE public.variations
  DROP CONSTRAINT IF EXISTS variations_claim_type_check;

-- Step 2: Re-create with all 5 allowed values
ALTER TABLE public.variations
  ADD CONSTRAINT variations_claim_type_check
  CHECK (claim_type IN ('cost', 'time', 'cost_and_time', 'schedule_of_rates', 'lump_sum'));

-- ============================================================
-- END OF MIGRATION
-- ============================================================