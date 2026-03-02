-- reset-demo.sql
-- Paste into Supabase Dashboard → SQL Editor → Run
-- Wipes all data for the demo company and reseeds 3 projects + 13 variations

DO $$
DECLARE
  cid UUID := 'cc196cf5-4708-4cfc-ae7e-c88386080b77'; -- demo company_id
  p1  UUID := gen_random_uuid();
  p2  UUID := gen_random_uuid();
  p3  UUID := gen_random_uuid();
  uid UUID;
BEGIN
  -- Get the admin/owner user id for created_by
  SELECT user_id INTO uid FROM public.company_members
  WHERE company_id = cid LIMIT 1;

  -- ── DELETE ────────────────────────────────────────────────────────────────
  DELETE FROM public.variation_notices WHERE company_id = cid;
  DELETE FROM public.variations WHERE project_id IN (SELECT id FROM public.projects WHERE company_id = cid);
  DELETE FROM public.projects WHERE company_id = cid;

  -- ── PROJECTS ──────────────────────────────────────────────────────────────
  INSERT INTO public.projects (id, company_id, created_by, name, client, reference, contract_type, is_active, notice_required, created_at, updated_at)
  VALUES
    (p1, cid, uid, 'Westgate Tunnel — Section 4B',   'CPBJH JV',              'WGT-4B-2025',  'lump_sum',             true, false, NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days'),
    (p2, cid, uid, 'Metro Crossing — Parkville',      'Rail Projects Australia','MC-PKV-2025',  'schedule_of_rates',    true, false, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),
    (p3, cid, uid, 'Northern Hospital — Mechanical',  'Lendlease',             'NH-MECH-2025', 'design_and_construct', true, false, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days');

  -- ── VARIATIONS ────────────────────────────────────────────────────────────
  -- Westgate Tunnel (7 vars)
  INSERT INTO public.variations (id, project_id, sequence_number, title, description, instruction_source, instructed_by, estimated_value, status, captured_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), p1, 1, 'Rock class upgrade — Chainage 4200-4350',        'Variation documented on site with photographic evidence.', 'latent_condition', 'Geotech Advisor',      3250000, 'approved',  NOW()-INTERVAL '25 days', NOW()-INTERVAL '25 days', NOW()-INTERVAL '25 days'),
    (gen_random_uuid(), p1, 2, 'Additional dewatering — wet season impact',       'Variation documented on site with photographic evidence.', 'site_instruction',  'Site Superintendent',  1850000, 'submitted', NOW()-INTERVAL '20 days', NOW()-INTERVAL '20 days', NOW()-INTERVAL '20 days'),
    (gen_random_uuid(), p1, 3, 'Traffic management plan revision 3',              'Variation documented on site with photographic evidence.', 'drawing_revision',  'Traffic Engineer',      420000, 'draft',     NOW()-INTERVAL '15 days', NOW()-INTERVAL '15 days', NOW()-INTERVAL '15 days'),
    (gen_random_uuid(), p1, 4, 'Utility relocation — Telstra conduit clash',      'Variation documented on site with photographic evidence.', 'rfi_response',      'Design Manager',       1180000, 'disputed',  NOW()-INTERVAL '18 days', NOW()-INTERVAL '18 days', NOW()-INTERVAL '18 days'),
    (gen_random_uuid(), p1, 5, 'Concrete spec change — 50MPa to 65MPa',           'Variation documented on site with photographic evidence.', 'drawing_revision',  'Structural Engineer',   890000, 'paid',      NOW()-INTERVAL '22 days', NOW()-INTERVAL '22 days', NOW()-INTERVAL '22 days'),
    (gen_random_uuid(), p1, 6, 'Night works premium — noise compliance',          'Variation documented on site with photographic evidence.', 'verbal_direction',  'Project Manager',      1650000, 'submitted', NOW()-INTERVAL '10 days', NOW()-INTERVAL '10 days', NOW()-INTERVAL '10 days'),
    (gen_random_uuid(), p1, 7, 'Contaminated soil disposal — PFAS detected',      'Variation documented on site with photographic evidence.', 'latent_condition',  'Environmental Officer',1640000, 'draft',     NOW()-INTERVAL '8 days',  NOW()-INTERVAL '8 days',  NOW()-INTERVAL '8 days');

  -- Metro Crossing (3 vars)
  INSERT INTO public.variations (id, project_id, sequence_number, title, description, instruction_source, instructed_by, estimated_value, status, captured_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), p2, 1, 'Platform extension — revised passenger modelling','Variation documented on site with photographic evidence.', 'drawing_revision',  'Design Lead',          2230000, 'approved',  NOW()-INTERVAL '19 days', NOW()-INTERVAL '19 days', NOW()-INTERVAL '19 days'),
    (gen_random_uuid(), p2, 2, 'Heritage wall protection — unexpected discovery',  'Variation documented on site with photographic evidence.', 'latent_condition',  'Heritage Advisor',     1450000, 'submitted', NOW()-INTERVAL '12 days', NOW()-INTERVAL '12 days', NOW()-INTERVAL '12 days'),
    (gen_random_uuid(), p2, 3, 'Signalling cable reroute — live rail proximity',   'Variation documented on site with photographic evidence.', 'site_instruction',  'Signalling Engineer',   850000, 'draft',     NOW()-INTERVAL '6 days',  NOW()-INTERVAL '6 days',  NOW()-INTERVAL '6 days');

  -- Northern Hospital (3 vars)
  INSERT INTO public.variations (id, project_id, sequence_number, title, description, instruction_source, instructed_by, estimated_value, status, captured_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), p3, 1, 'Chiller plant upgrade — capacity review',          'Variation documented on site with photographic evidence.', 'rfi_response',      'Mechanical Engineer',   780000, 'approved',  NOW()-INTERVAL '11 days', NOW()-INTERVAL '11 days', NOW()-INTERVAL '11 days'),
    (gen_random_uuid(), p3, 2, 'Fire damper replacement — non-compliant units',    'Variation documented on site with photographic evidence.', 'site_instruction',  'Fire Engineer',         450000, 'disputed',  NOW()-INTERVAL '7 days',  NOW()-INTERVAL '7 days',  NOW()-INTERVAL '7 days'),
    (gen_random_uuid(), p3, 3, 'BMS integration scope increase',                   'Variation documented on site with photographic evidence.', 'verbal_direction',  'BMS Contractor',        350000, 'draft',     NOW()-INTERVAL '3 days',  NOW()-INTERVAL '3 days',  NOW()-INTERVAL '3 days');

  RAISE NOTICE 'Reset complete. 3 projects, 13 variations inserted for company %.', cid;
END $$;
