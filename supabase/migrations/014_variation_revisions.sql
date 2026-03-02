-- Migration 014: Variation Revision System
-- Adds revision_number and parent_id to variations table
-- revision_number = 0 → original (all existing rows unaffected)
-- revision_number = N → Rev N
-- parent_id → FK to the variation this was revised from

ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.variations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_variations_parent ON public.variations(parent_id);
