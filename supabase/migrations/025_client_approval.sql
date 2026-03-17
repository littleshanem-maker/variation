-- 025_client_approval.sql
-- Adds client email approval flow to variations
-- Apply in Supabase SQL Editor

ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS approval_token UUID DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN IF NOT EXISTS approval_token_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  ADD COLUMN IF NOT EXISTS client_approval_response TEXT, -- 'approved' | 'rejected'
  ADD COLUMN IF NOT EXISTS client_approval_comment TEXT,
  ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ;

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_variations_approval_token
  ON public.variations(approval_token);

-- Backfill approval_token for existing rows that somehow got NULL
UPDATE public.variations
  SET approval_token = gen_random_uuid()
  WHERE approval_token IS NULL;
