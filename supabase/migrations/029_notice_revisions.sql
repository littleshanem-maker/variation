-- 029_notice_revisions.sql
-- Stores a snapshot of each revision at the point it was sent to the client

CREATE TABLE IF NOT EXISTS public.notice_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID NOT NULL REFERENCES public.variation_notices(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  -- Snapshot of notice content at time of send
  event_description TEXT,
  event_date TEXT,
  contract_clause TEXT,
  issued_by_name TEXT,
  issued_by_email TEXT,
  time_flag BOOLEAN,
  estimated_days NUMERIC,
  time_implication_unit TEXT,
  cost_flag BOOLEAN,
  cost_items JSONB,
  -- Send metadata
  sent_to TEXT,   -- comma-separated TO addresses
  sent_cc TEXT,   -- comma-separated CC addresses
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (notice_id, revision_number)
);

-- RLS
ALTER TABLE public.notice_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notice revisions for their company"
  ON public.notice_revisions FOR SELECT
  USING (
    notice_id IN (
      SELECT id FROM public.variation_notices
      WHERE company_id IN (
        SELECT company_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert notice revisions for their company"
  ON public.notice_revisions FOR INSERT
  WITH CHECK (
    notice_id IN (
      SELECT id FROM public.variation_notices
      WHERE company_id IN (
        SELECT company_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_notice_revisions_notice_id
  ON public.notice_revisions(notice_id, revision_number DESC);
