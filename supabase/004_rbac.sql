-- ============================================================
-- Variation Capture — RBAC Migration
-- Role-Based Access Control: companies, members, invitations
-- ============================================================

-- COMPANIES (tenants)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abn TEXT,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COMPANY MEMBERS (user <-> company <-> role)
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'office', 'field')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(company_id, user_id)
);

-- INVITATIONS (for users not yet signed up)
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'office', 'field')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ADD company_id TO PROJECTS
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_projects_company ON public.projects(company_id);

-- ============================================================
-- MIGRATION: Create a company for each existing user
-- ============================================================
DO $$
DECLARE
  r RECORD;
  new_company_id UUID;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.projects WHERE company_id IS NULL
  LOOP
    -- Create a company for this user
    INSERT INTO public.companies (id, name)
    VALUES (gen_random_uuid(), 'My Company')
    RETURNING id INTO new_company_id;

    -- Make them admin
    INSERT INTO public.company_members (company_id, user_id, role, accepted_at)
    VALUES (new_company_id, r.user_id, 'admin', now());

    -- Backfill their projects
    UPDATE public.projects
    SET company_id = new_company_id
    WHERE user_id = r.user_id AND company_id IS NULL;
  END LOOP;
END $$;

-- Now make company_id NOT NULL
ALTER TABLE public.projects ALTER COLUMN company_id SET NOT NULL;

-- Rename user_id to created_by (keep for audit trail)
ALTER TABLE public.projects RENAME COLUMN user_id TO created_by;

-- ============================================================
-- RLS HELPER FUNCTIONS
-- ============================================================

-- Get all company IDs for current user
CREATE OR REPLACE FUNCTION public.get_user_company_ids()
RETURNS SETOF UUID AS $$
  SELECT company_id FROM public.company_members
  WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get user's role in a specific company
CREATE OR REPLACE FUNCTION public.get_user_role(p_company_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.company_members
  WHERE user_id = auth.uid() AND company_id = p_company_id AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- DROP OLD RLS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "Users manage own projects" ON public.projects;
DROP POLICY IF EXISTS "Users manage own variations" ON public.variations;
DROP POLICY IF EXISTS "Users manage own photos" ON public.photo_evidence;
DROP POLICY IF EXISTS "Users manage own voice notes" ON public.voice_notes;
DROP POLICY IF EXISTS "Users manage own status changes" ON public.status_changes;

-- ============================================================
-- NEW RLS POLICIES — Company-scoped
-- ============================================================

-- COMPANIES
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own companies" ON public.companies
  FOR SELECT USING (id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Admin updates company" ON public.companies
  FOR UPDATE USING (public.get_user_role(id) = 'admin');

-- COMPANY MEMBERS
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see own company members" ON public.company_members
  FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Admin manages members" ON public.company_members
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

CREATE POLICY "Admin updates members" ON public.company_members
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

CREATE POLICY "Admin deletes members" ON public.company_members
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- INVITATIONS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages invitations" ON public.invitations
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

CREATE POLICY "Invitee can view own invitation" ON public.invitations
  FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- PROJECTS — Company-scoped
CREATE POLICY "Company members view projects" ON public.projects
  FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Office/admin create projects" ON public.projects
  FOR INSERT WITH CHECK (
    company_id IN (SELECT public.get_user_company_ids())
    AND public.get_user_role(company_id) IN ('admin', 'office')
  );

CREATE POLICY "Office/admin update projects" ON public.projects
  FOR UPDATE USING (
    company_id IN (SELECT public.get_user_company_ids())
    AND public.get_user_role(company_id) IN ('admin', 'office')
  );

CREATE POLICY "Admin deletes projects" ON public.projects
  FOR DELETE USING (
    company_id IN (SELECT public.get_user_company_ids())
    AND public.get_user_role(company_id) = 'admin'
  );

-- VARIATIONS — Company-scoped via project
CREATE POLICY "Company members view variations" ON public.variations
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.projects WHERE company_id IN (SELECT public.get_user_company_ids()))
  );

CREATE POLICY "Members create variations" ON public.variations
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE company_id IN (SELECT public.get_user_company_ids()))
  );

CREATE POLICY "Office/admin update variations" ON public.variations
  FOR UPDATE USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.company_id IN (SELECT public.get_user_company_ids())
      AND public.get_user_role(p.company_id) IN ('admin', 'office')
    )
  );

-- PHOTO EVIDENCE — Company-scoped via variation → project
CREATE POLICY "Company members view photos" ON public.photo_evidence
  FOR SELECT USING (
    variation_id IN (
      SELECT v.id FROM public.variations v
      JOIN public.projects p ON p.id = v.project_id
      WHERE p.company_id IN (SELECT public.get_user_company_ids())
    )
  );

CREATE POLICY "Members create photos" ON public.photo_evidence
  FOR INSERT WITH CHECK (
    variation_id IN (
      SELECT v.id FROM public.variations v
      JOIN public.projects p ON p.id = v.project_id
      WHERE p.company_id IN (SELECT public.get_user_company_ids())
    )
  );

-- VOICE NOTES — Company-scoped via variation → project
CREATE POLICY "Company members view voice notes" ON public.voice_notes
  FOR SELECT USING (
    variation_id IN (
      SELECT v.id FROM public.variations v
      JOIN public.projects p ON p.id = v.project_id
      WHERE p.company_id IN (SELECT public.get_user_company_ids())
    )
  );

CREATE POLICY "Members create voice notes" ON public.voice_notes
  FOR INSERT WITH CHECK (
    variation_id IN (
      SELECT v.id FROM public.variations v
      JOIN public.projects p ON p.id = v.project_id
      WHERE p.company_id IN (SELECT public.get_user_company_ids())
    )
  );

-- STATUS CHANGES — Company-scoped via variation → project
CREATE POLICY "Company members view status changes" ON public.status_changes
  FOR SELECT USING (
    variation_id IN (
      SELECT v.id FROM public.variations v
      JOIN public.projects p ON p.id = v.project_id
      WHERE p.company_id IN (SELECT public.get_user_company_ids())
    )
  );

CREATE POLICY "Office/admin create status changes" ON public.status_changes
  FOR INSERT WITH CHECK (
    variation_id IN (
      SELECT v.id FROM public.variations v
      JOIN public.projects p ON p.id = v.project_id
      WHERE p.company_id IN (SELECT public.get_user_company_ids())
      AND public.get_user_role(p.company_id) IN ('admin', 'office')
    )
  );

-- STORAGE — Update evidence bucket policy for company access
DROP POLICY IF EXISTS "Users manage own evidence files" ON storage.objects;

CREATE POLICY "Company members manage evidence files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'evidence'
    AND auth.uid() IS NOT NULL
  )
  WITH CHECK (
    bucket_id = 'evidence'
    AND auth.uid() IS NOT NULL
  );

-- AUTO-UPDATE TRIGGERS for new tables
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
