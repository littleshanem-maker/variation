#!/usr/bin/env node
/**
 * reset-demo.js — Hard reset the demo Supabase account back to seed data
 *
 * Usage:
 *   node reset-demo.js
 *
 * What it does:
 *   1. Signs in as the demo user
 *   2. Deletes ALL projects for that company (variations, notices etc cascade)
 *   3. Re-inserts 3 realistic Australian construction projects with 13 variations
 */

const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjE5NTEsImV4cCI6MjA4NzI5Nzk1MX0.f8DTWLnuITDS_SA42meoLwTCldqX34C7khm_zgjpP5o';

// Demo account credentials
const DEMO_EMAIL = 'bob@email.com';
const DEMO_PASSWORD = 'DemoPass2026!';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function uid() { return randomUUID(); }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
function rand(min, max) { return min + Math.random() * (max - min); }

async function run() {
  console.log('🔐 Signing in as demo user...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (authError) { console.error('❌ Auth failed:', authError.message); process.exit(1); }
  console.log('✅ Signed in:', authData.user.email);

  // Get company_id for this user
  const userId = authData.user.id;
  const { data: members } = await supabase.from('company_members').select('company_id').eq('user_id', userId);
  if (!members?.length) { console.error('❌ No company found for this user'); process.exit(1); }
  const companyId = members[0].company_id;
  console.log('🏢 Company ID:', companyId);

  // ── DELETE ──────────────────────────────────────────────────────────────────

  console.log('\n🗑️  Deleting all projects (variations + notices cascade)...');

  // variation_notices — cascade from projects but delete explicitly first to be safe
  const { data: projects } = await supabase.from('projects').select('id').eq('company_id', companyId);
  const projectIds = projects?.map(p => p.id) || [];

  if (projectIds.length > 0) {
    const { error: vne } = await supabase.from('variation_notices').delete().in('project_id', projectIds);
    if (vne) console.warn('  ⚠️  variation_notices delete:', vne.message);
    else console.log(`  ✅ variation_notices cleared`);

    const { error: ve } = await supabase.from('variations').delete().in('project_id', projectIds);
    if (ve) console.warn('  ⚠️  variations delete:', ve.message);
    else console.log(`  ✅ variations cleared`);
  }

  const { error: pe } = await supabase.from('projects').delete().eq('company_id', companyId);
  if (pe) { console.error('❌ Failed to delete projects:', pe.message); process.exit(1); }
  console.log('  ✅ projects cleared');

  // ── SEED ────────────────────────────────────────────────────────────────────

  console.log('\n🌱 Inserting seed projects...');

  const p1 = uid(), p2 = uid(), p3 = uid();

  const projects_seed = [
    { id: p1, company_id: companyId, created_by: userId, name: 'Westgate Tunnel — Section 4B', client: 'CPBJH JV', reference: 'WGT-4B-2025', contract_type: 'lump_sum', is_active: true, notice_required: false, created_at: daysAgo(28), updated_at: daysAgo(28) },
    { id: p2, company_id: companyId, created_by: userId, name: 'Metro Crossing — Parkville', client: 'Rail Projects Australia', reference: 'MC-PKV-2025', contract_type: 'schedule_of_rates', is_active: true, notice_required: false, created_at: daysAgo(21), updated_at: daysAgo(21) },
    { id: p3, company_id: companyId, created_by: userId, name: 'Northern Hospital — Mechanical', client: 'Lendlease', reference: 'NH-MECH-2025', contract_type: 'design_and_construct', is_active: true, notice_required: false, created_at: daysAgo(14), updated_at: daysAgo(14) },
  ];

  const { error: projErr } = await supabase.from('projects').insert(projects_seed);
  if (projErr) { console.error('❌ Failed to insert projects:', projErr.message); process.exit(1); }
  console.log('  ✅ 3 projects inserted');

  // ── VARIATIONS ──────────────────────────────────────────────────────────────

  console.log('\n🌱 Inserting seed variations...');

  const vars = [
    // Westgate Tunnel — 7 vars
    { pid: p1, seq: 1,  title: 'Rock class upgrade — Chainage 4200-4350',         source: 'latent_condition',  value: 3250000, status: 'approved',  by: 'Geotech Advisor',       daysAgo: 25 },
    { pid: p1, seq: 2,  title: 'Additional dewatering — wet season impact',        source: 'site_instruction',  value: 1850000, status: 'submitted', by: 'Site Superintendent',    daysAgo: 20 },
    { pid: p1, seq: 3,  title: 'Traffic management plan revision 3',               source: 'drawing_revision',  value: 420000,  status: 'draft',     by: 'Traffic Engineer',       daysAgo: 15 },
    { pid: p1, seq: 4,  title: 'Utility relocation — Telstra conduit clash',       source: 'rfi_response',      value: 1180000, status: 'disputed',  by: 'Design Manager',         daysAgo: 18 },
    { pid: p1, seq: 5,  title: 'Concrete spec change — 50MPa to 65MPa',            source: 'drawing_revision',  value: 890000,  status: 'paid',      by: 'Structural Engineer',    daysAgo: 22 },
    { pid: p1, seq: 6,  title: 'Night works premium — noise compliance',           source: 'verbal_direction',  value: 1650000, status: 'submitted', by: 'Project Manager',        daysAgo: 10 },
    { pid: p1, seq: 7,  title: 'Contaminated soil disposal — PFAS detected',       source: 'latent_condition',  value: 1640000, status: 'draft',     by: 'Environmental Officer',  daysAgo: 8  },
    // Metro Crossing — 3 vars
    { pid: p2, seq: 1,  title: 'Platform extension — revised passenger modelling', source: 'drawing_revision',  value: 2230000, status: 'approved',  by: 'Design Lead',            daysAgo: 19 },
    { pid: p2, seq: 2,  title: 'Heritage wall protection — unexpected discovery',  source: 'latent_condition',  value: 1450000, status: 'submitted', by: 'Heritage Advisor',       daysAgo: 12 },
    { pid: p2, seq: 3,  title: 'Signalling cable reroute — live rail proximity',   source: 'site_instruction',  value: 850000,  status: 'draft',     by: 'Signalling Engineer',    daysAgo: 6  },
    // Northern Hospital — 3 vars
    { pid: p3, seq: 1,  title: 'Chiller plant upgrade — capacity review',          source: 'rfi_response',      value: 780000,  status: 'approved',  by: 'Mechanical Engineer',    daysAgo: 11 },
    { pid: p3, seq: 2,  title: 'Fire damper replacement — non-compliant units',    source: 'site_instruction',  value: 450000,  status: 'disputed',  by: 'Fire Engineer',          daysAgo: 7  },
    { pid: p3, seq: 3,  title: 'BMS integration scope increase',                   source: 'verbal_direction',  value: 350000,  status: 'draft',     by: 'BMS Contractor',         daysAgo: 3  },
  ];

  const variations_seed = vars.map(v => ({
    id: uid(),
    project_id: v.pid,
    sequence_number: v.seq,
    title: v.title,
    description: `Variation for ${v.title.toLowerCase()}. Documented on site with photographic evidence.`,
    instruction_source: v.source,
    instructed_by: v.by,
    estimated_value: v.value,
    status: v.status,
    captured_at: daysAgo(v.daysAgo),
    created_at: daysAgo(v.daysAgo),
    updated_at: daysAgo(v.daysAgo),
  }));

  const { error: varErr } = await supabase.from('variations').insert(variations_seed);
  if (varErr) { console.error('❌ Failed to insert variations:', varErr.message); process.exit(1); }
  console.log('  ✅ 13 variations inserted');

  console.log('\n✅ Reset complete. 3 projects, 13 variations, 0 variation notices.');
  console.log('   Reload the app to see the fresh data.');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
