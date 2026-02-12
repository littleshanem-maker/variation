-- ============================================================
-- Variation Capture — Supabase Schema
-- Run this in your Supabase SQL Editor to set up cloud sync.
-- ============================================================

-- TABLES

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  contract_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.variations (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instruction_source TEXT NOT NULL,
  instructed_by TEXT,
  reference_doc TEXT,
  estimated_value INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'captured',
  captured_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_accuracy DOUBLE PRECISION,
  evidence_hash TEXT,
  notes TEXT,
  ai_description TEXT,
  ai_transcription TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_evidence (
  id UUID PRIMARY KEY,
  variation_id UUID NOT NULL REFERENCES public.variations(id) ON DELETE CASCADE,
  remote_uri TEXT,
  sha256_hash TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  width INTEGER,
  height INTEGER,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.voice_notes (
  id UUID PRIMARY KEY,
  variation_id UUID NOT NULL REFERENCES public.variations(id) ON DELETE CASCADE,
  remote_uri TEXT,
  duration_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  transcription TEXT,
  transcription_status TEXT NOT NULL DEFAULT 'none',
  sha256_hash TEXT,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.status_changes (
  id UUID PRIMARY KEY,
  variation_id UUID NOT NULL REFERENCES public.variations(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL,
  changed_by TEXT,
  notes TEXT
);

-- INDEXES

CREATE INDEX idx_projects_user ON public.projects(user_id);
CREATE INDEX idx_variations_project ON public.variations(project_id);
CREATE INDEX idx_variations_status ON public.variations(status);
CREATE INDEX idx_photos_variation ON public.photo_evidence(variation_id);
CREATE INDEX idx_voice_variation ON public.voice_notes(variation_id);
CREATE INDEX idx_status_variation ON public.status_changes(variation_id);

-- ROW LEVEL SECURITY

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own variations" ON public.variations
  FOR ALL USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own photos" ON public.photo_evidence
  FOR ALL USING (variation_id IN (
    SELECT v.id FROM public.variations v JOIN public.projects p ON p.id = v.project_id WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users manage own voice notes" ON public.voice_notes
  FOR ALL USING (variation_id IN (
    SELECT v.id FROM public.variations v JOIN public.projects p ON p.id = v.project_id WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Users manage own status changes" ON public.status_changes
  FOR ALL USING (variation_id IN (
    SELECT v.id FROM public.variations v JOIN public.projects p ON p.id = v.project_id WHERE p.user_id = auth.uid()
  ));

-- STORAGE

INSERT INTO storage.buckets (id, name, public) VALUES ('evidence', 'evidence', false) ON CONFLICT DO NOTHING;

CREATE POLICY "Users manage own evidence files" ON storage.objects
  FOR ALL USING (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

-- AUTO-UPDATE TRIGGER

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_variations_updated_at BEFORE UPDATE ON public.variations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
