-- ============================================================
-- Migration: 048_drop_accept_invitation_uuid_overload
-- Run via: Supabase Dashboard → SQL Editor → Run
-- Date: 2026-05-05
-- ============================================================

BEGIN;

-- Fix the RPC overload ambiguity:
-- There are TWO accept_invitation functions:
--   accept_invitation(invite_token TEXT)   ← our correct one in 007
--   accept_invitation(invite_token UUID)  ← causes "could not choose best candidate"
--
-- Drop the UUID variant so only the TEXT version exists.
-- Tokens are strings (UUID format text), passed as JSON string → TEXT parameter.

DROP FUNCTION IF EXISTS public.accept_invitation(uuid);

COMMIT;

-- Verification:
-- SELECT proname, proargtypes::regtype[] FROM pg_proc
-- WHERE proname = 'accept_invitation' AND pronamespace = 'public'::regnamespace;
-- Should show only accept_invitation(text) → returns void