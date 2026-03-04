-- 019_company_branding.sql
-- Add preferred_standard to companies for template selection
-- Apply via Supabase Dashboard → SQL Editor → Run

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS preferred_standard TEXT DEFAULT 'both'
    CHECK (preferred_standard IN ('AS4000', 'AS2124', 'both'));

COMMENT ON COLUMN public.companies.preferred_standard IS
  'Which Australian Standard to cite in variation documents: AS4000, AS2124, or both';

-- Also ensure address and phone columns exist (added in earlier migrations)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone TEXT;
