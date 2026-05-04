-- 044_latest_variations_view.sql
-- Returns only the latest revision per variation (per project + sequence_number).
-- All register, dashboard, and list queries should read from this view
-- instead of querying the variations table directly.

CREATE OR REPLACE VIEW public.latest_variations AS
SELECT DISTINCT ON (project_id, sequence_number) *
FROM public.variations
ORDER BY project_id, sequence_number, COALESCE(revision_number, 0) DESC;

-- Grant same access as the base table
GRANT SELECT ON public.latest_variations TO anon, authenticated;

-- RLS on the underlying table still applies — no additional policies needed.
