-- 030_variation_request_revisions.sql
-- Stores a snapshot of each variation request revision at the point it was sent to the client

CREATE TABLE IF NOT EXISTS public.variation_request_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_id UUID NOT NULL REFERENCES public.variations(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  -- Snapshot of variation content at time of send
  title TEXT,
  description TEXT,
  estimated_value BIGINT,
  cost_items JSONB,
  status TEXT,
  client_email TEXT,
  response_due_date TEXT,
  -- Send metadata
  sent_to TEXT,   -- comma-separated TO addresses
  sent_cc TEXT,   -- comma-separated CC addresses
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (variation_id, revision_number)
);

-- RLS
ALTER TABLE public.variation_request_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view variation request revisions for their company"
  ON public.variation_request_revisions FOR SELECT
  USING (
    variation_id IN (
      SELECT id FROM public.variations
      WHERE project_id IN (
        SELECT id FROM public.projects
        WHERE company_id IN (
          SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Authenticated users can insert variation request revisions"
  ON public.variation_request_revisions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_variation_request_revisions_variation_id
  ON public.variation_request_revisions(variation_id, revision_number DESC);
