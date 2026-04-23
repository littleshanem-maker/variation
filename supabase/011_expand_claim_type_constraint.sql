-- Migration 011: Expand variations claim_type constraint
-- Allowed values: lump_sum, cost_plus, schedule_of_rates, time_impact_only, cost_and_time
--
-- HOW TO APPLY:
-- Copy the SQL below and paste into your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ketidyzumcdxditjfruk/sql

-- ============================================================
-- SQL TO RUN IN SUPABASE SQL EDITOR
-- ============================================================

ALTER TABLE public.variations
  DROP CONSTRAINT IF EXISTS variations_claim_type_check;

ALTER TABLE public.variations
  ADD CONSTRAINT variations_claim_type_check
  CHECK (claim_type IN ('lump_sum', 'cost_plus', 'schedule_of_rates', 'time_impact_only', 'cost_and_time'));

-- ============================================================