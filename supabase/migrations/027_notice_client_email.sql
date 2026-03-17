-- 027_notice_client_email.sql
-- Adds client_email to variation_notices for Send to Client flow

ALTER TABLE public.variation_notices
  ADD COLUMN IF NOT EXISTS client_email TEXT;
