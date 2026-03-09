-- Migration 020: Add time_implication_unit to variation_notices
-- Allows time implications to be recorded in hours or days

ALTER TABLE public.variation_notices
  ADD COLUMN IF NOT EXISTS time_implication_unit TEXT
    CHECK (time_implication_unit IN ('hours', 'days'))
    DEFAULT 'days';

-- Backfill existing rows that have a time implication
UPDATE public.variation_notices
  SET time_implication_unit = 'days'
  WHERE time_flag = true AND estimated_days IS NOT NULL AND time_implication_unit IS NULL;
