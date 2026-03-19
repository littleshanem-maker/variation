-- 032_client_contacts.sql
-- Saves previously used client emails per company for typeahead suggestions

CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text,
  email text NOT NULL,
  use_count integer DEFAULT 1,
  last_used timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, email)
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their company contacts"
  ON public.client_contacts
  FOR ALL
  USING (company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND is_active = true
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND is_active = true
  ));
