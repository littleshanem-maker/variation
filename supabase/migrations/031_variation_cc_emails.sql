-- 031_variation_cc_emails.sql
-- Adds cc_emails to variations for Send to Client flow

ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS cc_emails TEXT;
