-- 015_due_date.sql
-- Adds response_due_date to variations table
-- Apply via Supabase Dashboard → SQL Editor → Run

ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS response_due_date DATE;

COMMENT ON COLUMN public.variations.response_due_date IS
  'Date by which a response to this variation is required (user-set)';
