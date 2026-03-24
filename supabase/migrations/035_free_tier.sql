-- Migration 035: Free Tier
-- ⚠️ Shane must apply this migration manually to production via the Supabase SQL editor
-- Date: 2026-03-24

-- 1. Add plan columns to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  ADD COLUMN IF NOT EXISTS variation_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variation_limit INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS project_limit INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS upgraded_at TIMESTAMPTZ NULL;

-- 2. Existing companies that already have data should be promoted to pro
--    (they signed up via Stripe, so they're paying customers)
UPDATE public.companies
SET plan = 'pro',
    variation_limit = NULL,
    project_limit = NULL
WHERE id IN (
  SELECT DISTINCT company_id
  FROM public.company_members
  WHERE is_active = true
);

-- Note: New free signups will stay with the defaults (plan='free', variation_limit=3, project_limit=1)

-- 3. Back-fill variation_count from existing variations
UPDATE public.companies c
SET variation_count = (
  SELECT COUNT(*)
  FROM public.variations v
  JOIN public.projects p ON p.id = v.project_id
  WHERE p.company_id = c.id
);

-- 4. Trigger to keep variation_count in sync on INSERT/DELETE
CREATE OR REPLACE FUNCTION public.update_company_variation_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT company_id INTO v_company_id FROM public.projects WHERE id = NEW.project_id;
    UPDATE public.companies SET variation_count = variation_count + 1 WHERE id = v_company_id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT company_id INTO v_company_id FROM public.projects WHERE id = OLD.project_id;
    UPDATE public.companies SET variation_count = GREATEST(0, variation_count - 1) WHERE id = v_company_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS update_variation_count ON public.variations;
CREATE TRIGGER update_variation_count
  AFTER INSERT OR DELETE ON public.variations
  FOR EACH ROW EXECUTE FUNCTION public.update_company_variation_count();

-- 5. Update provision_new_account to set plan defaults for new free signups
CREATE OR REPLACE FUNCTION public.provision_new_account(
  p_company_id UUID,
  p_company_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = v_user_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User already has a company';
  END IF;

  -- Create company with free tier defaults
  INSERT INTO public.companies (id, name, plan, variation_limit, project_limit, variation_count, created_at)
  VALUES (p_company_id, p_company_name, 'free', 3, 1, 0, NOW());

  INSERT INTO public.company_members (
    id, company_id, user_id, role, is_active, invited_at, accepted_at
  )
  VALUES (
    gen_random_uuid(),
    p_company_id,
    v_user_id,
    'admin',
    true,
    NOW(),
    NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_new_account(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_new_account(UUID, TEXT) TO authenticated;

-- 6. Function to upgrade a company to pro (called from webhook)
CREATE OR REPLACE FUNCTION public.upgrade_company_to_pro(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.companies
  SET plan = 'pro',
      variation_limit = NULL,
      project_limit = NULL,
      upgraded_at = NOW()
  WHERE id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upgrade_company_to_pro(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upgrade_company_to_pro(UUID) TO service_role;
