-- ============================================================
-- Migration 011: Variation Workflow Improvements
-- 
-- Changes:
--   1. Add variation_number column (VAR-001 format)
--   2. Add requestor_name and requestor_email columns
--   3. Update status default from 'captured' to 'draft'
--   4. Migrate existing 'captured' records to 'draft'
--   5. Backfill variation_number for existing records
-- ============================================================

-- 1. Add new columns to variations table
ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS variation_number TEXT,
  ADD COLUMN IF NOT EXISTS requestor_name TEXT,
  ADD COLUMN IF NOT EXISTS requestor_email TEXT;

-- 2. Update status default to 'draft'
ALTER TABLE public.variations
  ALTER COLUMN status SET DEFAULT 'draft';

-- 3. Migrate existing 'captured' status to 'draft'
UPDATE public.variations
  SET status = 'draft'
  WHERE status = 'captured';

-- Also update status_changes history
UPDATE public.status_changes
  SET from_status = 'draft'
  WHERE from_status = 'captured';

UPDATE public.status_changes
  SET to_status = 'draft'
  WHERE to_status = 'captured';

-- 4. Backfill variation_number for existing records
--    Format: VAR-001, VAR-002, ... (padded to 3 digits, per project)
UPDATE public.variations
  SET variation_number = 'VAR-' || LPAD(sequence_number::TEXT, 3, '0')
  WHERE variation_number IS NULL;

-- 5. Add index on variation_number for display lookups
CREATE INDEX IF NOT EXISTS idx_variations_variation_number
  ON public.variations(variation_number);

-- ============================================================
-- NOTES:
--   Valid status values are now:
--     draft       → initial state (previously 'captured')
--     submitted   → sent to client for review
--     approved    → client approved
--     rejected    → client rejected
--     disputed    → under dispute
--
--   Status transitions (enforced in application layer):
--     draft       → submitted
--     submitted   → approved | rejected | disputed
--
--   The 'paid' status is preserved for backward compatibility.
-- ============================================================
