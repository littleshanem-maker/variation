-- 016_as_compliance.sql
-- AS 4000 / AS 2124 compliance fields + response_due_date on notices
-- Apply via Supabase Dashboard → SQL Editor → Run

-- Variations table: AS compliance fields
ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS claim_type TEXT DEFAULT 'cost'
    CHECK (claim_type IN ('cost', 'time', 'cost_and_time'));

ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS eot_days_claimed INTEGER;

ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS basis_of_valuation TEXT
    CHECK (basis_of_valuation IN ('agreement', 'contract_rates', 'daywork', 'reasonable_rates'));

-- Projects table: contract number
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contract_number TEXT;

-- Variation notices table: response due date
ALTER TABLE public.variation_notices
  ADD COLUMN IF NOT EXISTS response_due_date DATE;

COMMENT ON COLUMN public.variations.claim_type IS 'Type of claim: cost only, time only, or cost and time';
COMMENT ON COLUMN public.variations.eot_days_claimed IS 'Extension of time claimed in calendar days';
COMMENT ON COLUMN public.variations.basis_of_valuation IS 'How the variation value was calculated per AS 4000/AS 2124';
COMMENT ON COLUMN public.projects.contract_number IS 'Contract reference number';
COMMENT ON COLUMN public.variation_notices.response_due_date IS 'Date by which a response is required';
