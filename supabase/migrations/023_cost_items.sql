-- Migration 023: Cost breakdown items
-- Adds JSONB cost_items to both variation_notices and variations
-- Also adds time_implication_unit to variations (already exists on notices via 020)

-- Cost items on variation notices
ALTER TABLE public.variation_notices
  ADD COLUMN IF NOT EXISTS cost_items JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Cost items on variations
ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS cost_items JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Time implication unit on variations (mirrors notice field from migration 020)
ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS time_implication_unit TEXT
    CHECK (time_implication_unit IN ('hours', 'days'))
    DEFAULT 'days';

COMMENT ON COLUMN public.variation_notices.cost_items IS
  'JSON array of cost line items: [{id, description, qty, unit, rate, total}]';

COMMENT ON COLUMN public.variations.cost_items IS
  'JSON array of cost line items: [{id, description, qty, unit, rate, total}]';

COMMENT ON COLUMN public.variations.time_implication_unit IS
  'Unit for EOT claim: hours or days';
