-- reset-demo.sql
-- Paste into Supabase Dashboard → SQL Editor → Run
-- Wipes all data for the Vecta demo company and reseeds 3 projects + 13 variations

DO $$
DECLARE
  cid UUID := 'cc196cf5-4708-4cfc-ae7e-c88386080b77'; -- Vecta Group demo company_id
  p1  UUID := gen_random_uuid();
  p2  UUID := gen_random_uuid();
  p3  UUID := gen_random_uuid();
  uid UUID;
BEGIN
  -- Get the admin/owner user id for created_by
  SELECT user_id INTO uid FROM public.company_members
  WHERE company_id = cid AND role = 'admin' LIMIT 1;

  -- ── DELETE ────────────────────────────────────────────────────────────────
  -- Documents linked to notices or variations for this company
  DELETE FROM public.documents
  WHERE notice_id IN (SELECT id FROM public.variation_notices WHERE company_id = cid)
     OR variation_id IN (SELECT v.id FROM public.variations v JOIN public.projects p ON v.project_id = p.id WHERE p.company_id = cid);

  -- Status changes linked to variations for this company
  DELETE FROM public.status_changes
  WHERE variation_id IN (SELECT v.id FROM public.variations v JOIN public.projects p ON v.project_id = p.id WHERE p.company_id = cid);

  -- Notices, variations, projects
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
  INSERT INTO public.variations (id, project_id, sequence_number, title, description, instruction_source, instructed_by, estimated_value, status, response_due_date, captured_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), p1, 1, 'Rock class upgrade — Chainage 4200-4350',        'Actual rock classification encountered at Chainage 4200-4350 exceeds the class assumed in the contract design. Additional excavation equipment and disposal costs incurred.', 'latent_condition', 'Geotech Advisor',       3250000, 'approved',  (CURRENT_DATE - INTERVAL '5 days')::date,  NOW()-INTERVAL '25 days', NOW()-INTERVAL '25 days', NOW()-INTERVAL '25 days'),
    (gen_random_uuid(), p1, 2, 'Additional dewatering — wet season impact',       'Sustained rainfall in Feb/Mar 2025 required additional dewatering pumps and extended operation hours beyond the contracted scope.', 'site_instruction',  'Site Superintendent',   1850000, 'submitted', (CURRENT_DATE - INTERVAL '2 days')::date,  NOW()-INTERVAL '20 days', NOW()-INTERVAL '20 days', NOW()-INTERVAL '20 days'),
    (gen_random_uuid(), p1, 3, 'Traffic management plan revision 3',              'Principal issued revised TMP on 18 Feb 2025 requiring additional lane closures and extended traffic control hours not included in the original TMP scope.', 'drawing_revision',  'Traffic Engineer',       420000, 'draft',     (CURRENT_DATE + INTERVAL '5 days')::date,  NOW()-INTERVAL '15 days', NOW()-INTERVAL '15 days', NOW()-INTERVAL '15 days'),
    (gen_random_uuid(), p1, 4, 'Utility relocation — Telstra conduit clash',      'Uncharted Telstra conduit discovered at Chainage 4310. Relocation required before pile installation could proceed. Not shown on as-built drawings provided at tender.', 'rfi_response',      'Design Manager',        1180000, 'disputed',  (CURRENT_DATE - INTERVAL '3 days')::date,  NOW()-INTERVAL '18 days', NOW()-INTERVAL '18 days', NOW()-INTERVAL '18 days'),
    (gen_random_uuid(), p1, 5, 'Concrete spec change — 50MPa to 65MPa',           'Structural engineer directed upgrade from 50MPa to 65MPa concrete for all pile caps following revised geotechnical assessment. Material cost differential and extended cure period.', 'drawing_revision',  'Structural Engineer',    890000, 'paid',      (CURRENT_DATE - INTERVAL '10 days')::date, NOW()-INTERVAL '22 days', NOW()-INTERVAL '22 days', NOW()-INTERVAL '22 days'),
    (gen_random_uuid(), p1, 6, 'Night works premium — noise compliance',          'EPA noise compliance requirements directed by Principal required all concrete pours to be completed between 10pm-6am. Night shift premium applies to 14 pour events not priced at tender.', 'verbal_direction',  'Project Manager',       1650000, 'submitted', CURRENT_DATE::date,                        NOW()-INTERVAL '10 days', NOW()-INTERVAL '10 days', NOW()-INTERVAL '10 days'),
    (gen_random_uuid(), p1, 7, 'Contaminated soil disposal — PFAS detected',      'PFAS contamination detected in fill material during earthworks at Chainage 4280. All contaminated material requires transport to licensed facility at significant cost premium over standard disposal.', 'latent_condition',  'Environmental Officer', 1640000, 'draft',     (CURRENT_DATE + INTERVAL '7 days')::date,  NOW()-INTERVAL '8 days',  NOW()-INTERVAL '8 days',  NOW()-INTERVAL '8 days');

  -- Metro Crossing (3 vars)
  INSERT INTO public.variations (id, project_id, sequence_number, title, description, instruction_source, instructed_by, estimated_value, status, response_due_date, captured_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), p2, 1, 'Platform extension — revised passenger modelling','Updated passenger modelling from Transport for Victoria requires platform extension by 12m at the southern end. Issued via design revision 007 dated 12 Feb 2025.', 'drawing_revision',  'Design Lead',           2230000, 'approved',  (CURRENT_DATE - INTERVAL '7 days')::date,  NOW()-INTERVAL '19 days', NOW()-INTERVAL '19 days', NOW()-INTERVAL '19 days'),
    (gen_random_uuid(), p2, 2, 'Heritage wall protection — unexpected discovery',  'Discovery of heritage-listed bluestone wall during excavation for services trench. Heritage Victoria direction to halt works and implement protection measures pending assessment.', 'latent_condition',  'Heritage Advisor',      1450000, 'submitted', (CURRENT_DATE - INTERVAL '1 day')::date,   NOW()-INTERVAL '12 days', NOW()-INTERVAL '12 days', NOW()-INTERVAL '12 days'),
    (gen_random_uuid(), p2, 3, 'Signalling cable reroute — live rail proximity',   'Existing signalling cables located closer to works zone than shown on reference drawings. MTM safety requirement to reroute before works could proceed within 3m clearance.', 'site_instruction',  'Signalling Engineer',    850000, 'draft',     (CURRENT_DATE + INTERVAL '3 days')::date,  NOW()-INTERVAL '6 days',  NOW()-INTERVAL '6 days',  NOW()-INTERVAL '6 days');

  -- Northern Hospital (3 vars)
  INSERT INTO public.variations (id, project_id, sequence_number, title, description, instruction_source, instructed_by, estimated_value, status, response_due_date, captured_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), p3, 1, 'Chiller plant upgrade — capacity review',          'Revised hospital capacity planning requires chiller plant upgrade from 800kW to 1100kW. Design revision issued 5 Mar 2025.', 'rfi_response',      'Mechanical Engineer',    780000, 'approved',  (CURRENT_DATE - INTERVAL '3 days')::date,  NOW()-INTERVAL '11 days', NOW()-INTERVAL '11 days', NOW()-INTERVAL '11 days'),
    (gen_random_uuid(), p3, 2, 'Fire damper replacement — non-compliant units',    'BCA audit identified 23 installed fire dampers as non-compliant with AS 1668.1-2015 amendment. Direction to replace all non-compliant units before occupation certificate.', 'site_instruction',  'Fire Engineer',          450000, 'disputed',  (CURRENT_DATE)::date,                      NOW()-INTERVAL '7 days',  NOW()-INTERVAL '7 days',  NOW()-INTERVAL '7 days'),
    (gen_random_uuid(), p3, 3, 'BMS integration scope increase',                   'Additional BMS integration points required for new ICU equipment not included in the original equipment schedule. Directed by Hospital Facilities Manager 8 Mar 2025.', 'verbal_direction',  'BMS Contractor',         350000, 'draft',     (CURRENT_DATE + INTERVAL '10 days')::date, NOW()-INTERVAL '3 days',  NOW()-INTERVAL '3 days',  NOW()-INTERVAL '3 days');

  RAISE NOTICE 'Reset complete. 3 projects, 13 variations inserted for Vecta demo company.';
END $$;
