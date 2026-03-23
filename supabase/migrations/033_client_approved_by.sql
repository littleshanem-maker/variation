-- 033_client_approved_by.sql
-- Track who clicked approve/reject (To vs CC distinction)
-- Also store cc_emails on the variation record for validation

ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS client_approved_by_email TEXT,
  ADD COLUMN IF NOT EXISTS client_approved_by_name TEXT;

-- cc_emails already added in 031 but ensure it exists
ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS cc_emails TEXT;
