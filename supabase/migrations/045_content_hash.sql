-- 045_content_hash.sql
-- Add content_hash to variation_request_revisions for change detection.
-- When submitting to client, store a hash of the tracked content fields.
-- On resubmit, compare hashes — only increment revision if content changed.

ALTER TABLE public.variation_request_revisions
  ADD COLUMN IF NOT EXISTS content_hash TEXT;
