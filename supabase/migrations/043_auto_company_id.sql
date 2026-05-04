-- 043_auto_company_id.sql
-- Auto-set company_id on projects when mobile pushes without it.
-- This means the mobile app doesn't need to know about company_id
-- for new projects to appear correctly in the web app.

CREATE OR REPLACE FUNCTION public.auto_set_project_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT cm.company_id INTO NEW.company_id
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.is_active = true
    ORDER BY cm.invited_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_set_project_company_id ON public.projects;

CREATE TRIGGER trg_auto_set_project_company_id
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_project_company_id();
