-- Migration 024: Fix documents RLS + add notice_id column
-- The old policy used p.user_id which doesn't exist and blocked multi-user companies

-- Add notice_id if not already there
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS notice_id UUID REFERENCES public.variation_notices(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS documents_notice_id_idx ON public.documents(notice_id);

-- Drop the broken old policy
DROP POLICY IF EXISTS "Users manage own documents" ON public.documents;

-- New policy: any active company member can manage documents for their company's variations/notices
CREATE POLICY "Company members manage documents" ON public.documents
  FOR ALL USING (
    (
      variation_id IS NOT NULL AND variation_id IN (
        SELECT v.id FROM public.variations v
        JOIN public.projects p ON p.id = v.project_id
        JOIN public.company_members cm ON cm.company_id = p.company_id
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
      )
    )
    OR
    (
      notice_id IS NOT NULL AND notice_id IN (
        SELECT vn.id FROM public.variation_notices vn
        JOIN public.company_members cm ON cm.company_id = vn.company_id
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
      )
    )
  )
  WITH CHECK (
    (
      variation_id IS NOT NULL AND variation_id IN (
        SELECT v.id FROM public.variations v
        JOIN public.projects p ON p.id = v.project_id
        JOIN public.company_members cm ON cm.company_id = p.company_id
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
      )
    )
    OR
    (
      notice_id IS NOT NULL AND notice_id IN (
        SELECT vn.id FROM public.variation_notices vn
        JOIN public.company_members cm ON cm.company_id = vn.company_id
        WHERE cm.user_id = auth.uid() AND cm.is_active = true
      )
    )
  );

-- Fix storage objects policy to also allow company members (not just the owner)
-- The existing policy restricts by auth.uid() as first folder - keep that for storage isolation
-- but we need to ensure the documents table policy is what gates access, not storage path
