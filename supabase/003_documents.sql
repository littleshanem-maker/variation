-- Documents table for variation attachments
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY,
  variation_id UUID NOT NULL REFERENCES public.variations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_variation ON public.documents(variation_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own documents" ON public.documents
  FOR ALL USING (variation_id IN (
    SELECT v.id FROM public.variations v JOIN public.projects p ON p.id = v.project_id WHERE p.user_id = auth.uid()
  ));

-- Documents storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Users manage own document files" ON storage.objects
  FOR ALL USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
