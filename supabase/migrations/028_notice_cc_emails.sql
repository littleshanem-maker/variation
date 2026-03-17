-- 028_notice_cc_emails.sql
-- client_email becomes comma-separated TO list
-- cc_emails stores comma-separated CC list (internal team)

ALTER TABLE public.variation_notices
  ADD COLUMN IF NOT EXISTS cc_emails TEXT;
