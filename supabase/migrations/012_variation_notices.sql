-- ============================================================
-- Migration 012: Variation Notice Feature
-- ============================================================

-- 1. Create variation_notices table
CREATE TABLE IF NOT EXISTS public.variation_notices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notice_number     TEXT NOT NULL,         -- VN-001 format
  sequence_number   INTEGER NOT NULL,      -- per-project sequence
  event_description TEXT NOT NULL,
  event_date        DATE NOT NULL,
  cost_flag         BOOLEAN NOT NULL DEFAULT true,
  time_flag         BOOLEAN NOT NULL DEFAULT false,
  estimated_days    INTEGER,               -- rough time implication, nullable
  contract_clause   TEXT,                  -- e.g. "Clause 36.1", nullable
  issued_by_name    TEXT,
  issued_by_email   TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'issued', 'acknowledged')),
  issued_at         TIMESTAMPTZ,
  acknowledged_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add notice_id FK to variations (nullable — null = notice skipped)
ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS notice_id UUID REFERENCES public.variation_notices(id) ON DELETE SET NULL;

-- 3. Add notice_required to projects (default false — existing projects unaffected)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS notice_required BOOLEAN NOT NULL DEFAULT false;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_variation_notices_project_id
  ON public.variation_notices(project_id);

CREATE INDEX IF NOT EXISTS idx_variation_notices_company_id
  ON public.variation_notices(company_id);

CREATE INDEX IF NOT EXISTS idx_variations_notice_id
  ON public.variations(notice_id);

-- 5. RLS — mirror the pattern used on variations table
ALTER TABLE public.variation_notices ENABLE ROW LEVEL SECURITY;

-- Members of the company can read notices for their company
CREATE POLICY "Company members can read notices"
  ON public.variation_notices FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Field/office/admin can insert
CREATE POLICY "Company members can insert notices"
  ON public.variation_notices FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Non-field members can update
CREATE POLICY "Office and admin can update notices"
  ON public.variation_notices FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
