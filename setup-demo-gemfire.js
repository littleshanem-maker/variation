#!/usr/bin/env node
/**
 * setup-demo-gemfire.js — Create / reset the GEM Fire demo account
 *
 * Usage:
 *   node setup-demo-gemfire.js
 *
 * Login:
 *   Email:    demo-gemfire@leveragedsystems.com.au
 *   Password: GemFireDemo2026!
 *
 * Scenario: GEM Fire Protection — fire suppression subcontractor
 *   Projects: hospital fire upgrade, CBD car park FM200, tunnel suppression
 *   Mix of statuses, realistic values, variation notices included
 */

const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL   = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjE5NTEsImV4cCI6MjA4NzI5Nzk1MX0.f8DTWLnuITDS_SA42meoLwTCldqX34C7khm_zgjpP5o';

const DEMO_EMAIL    = 'demo-gemfire@leveragedsystems.com.au';
const DEMO_PASSWORD = 'GemFireDemo2026!';
const COMPANY_NAME  = 'GEM Fire Protection';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

function uid()         { return randomUUID(); }
function daysAgo(n)    { return new Date(Date.now() - n * 86400000).toISOString(); }
function daysAhead(n)  { return new Date(Date.now() + n * 86400000).toISOString().slice(0,10); }

async function getOrCreateAccount() {
  // Try sign in first
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (!signInError) {
    console.log('✅ Signed in as existing demo user');
    // Ensure company exists — provision if missing
    const { data: members } = await supabase.from('company_members').select('company_id').eq('user_id', signInData.user.id);
    if (!members?.length) {
      console.log('⚠️  No company found — provisioning...');
      const { error: provErr } = await supabase.rpc('provision_new_account', { p_company_id: require('crypto').randomUUID(), p_company_name: COMPANY_NAME });
      if (provErr) { console.error('❌ Provision failed:', provErr.message); process.exit(1); }
      console.log('✅ Company provisioned');
    }
    return signInData.user;
  }

  console.log('📝 Account not found — creating...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    options: {
      data: { display_name: 'Kai Richards', company_name: COMPANY_NAME },
    },
  });

  if (signUpError) { console.error('❌ Sign up failed:', signUpError.message); process.exit(1); }
  console.log('✅ Account created:', signUpData.user.email);

  // Provision company
  const { error: provErr } = await supabase.rpc('provision_new_account', { p_company_id: uid(), p_company_name: COMPANY_NAME });
  if (provErr) console.warn('⚠️  provision_new_account:', provErr.message, '(may already exist)');
  else console.log('✅ Company provisioned:', COMPANY_NAME);

  // Re-sign in after provision
  const { data: reSignIn } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  return reSignIn.user;
}

async function run() {
  console.log('\n🔥 GEM Fire Protection — Demo Setup\n');

  const user = await getOrCreateAccount();
  if (!user) { console.error('❌ Could not get user'); process.exit(1); }

  const { data: members } = await supabase.from('company_members').select('company_id').eq('user_id', user.id);
  if (!members?.length) { console.error('❌ No company found'); process.exit(1); }
  const companyId = members[0].company_id;
  console.log('🏢 Company ID:', companyId);

  // ── DELETE ───────────────────────────────────────────────────────────────────
  console.log('\n🗑️  Clearing existing data...');
  const { data: existingProjects } = await supabase.from('projects').select('id').eq('company_id', companyId);
  const projectIds = existingProjects?.map(p => p.id) || [];

  if (projectIds.length > 0) {
    await supabase.from('variation_notices').delete().in('project_id', projectIds);
    await supabase.from('variations').delete().in('project_id', projectIds);
  }
  await supabase.from('projects').delete().eq('company_id', companyId);
  console.log('✅ Cleared');

  // ── PROJECTS ─────────────────────────────────────────────────────────────────
  console.log('\n🌱 Inserting projects...');

  const p1 = uid(), p2 = uid(), p3 = uid();

  const { error: projErr } = await supabase.from('projects').insert([
    {
      id: p1, company_id: companyId, created_by: user.id,
      name: 'Austin Health — Fire Suppression Upgrade',
      client: 'Multiplex Constructions',
      reference: 'AH-FIRE-2025',
      contract_type: 'lump_sum',
      is_active: true, notice_required: true,
      created_at: daysAgo(45), updated_at: daysAgo(45),
    },
    {
      id: p2, company_id: companyId, created_by: user.id,
      name: 'Melbourne CBD — Parking Station FM200',
      client: 'Hansen Yuncken',
      reference: 'CBD-PS-FM200',
      contract_type: 'schedule_of_rates',
      is_active: true, notice_required: false,
      created_at: daysAgo(30), updated_at: daysAgo(30),
    },
    {
      id: p3, company_id: companyId, created_by: user.id,
      name: 'Metro Tunnelling — Fire Suppression System',
      client: 'CIMIC / CPB JV',
      reference: 'MTR-FIRE-001',
      contract_type: 'design_and_construct',
      is_active: true, notice_required: true,
      created_at: daysAgo(20), updated_at: daysAgo(20),
    },
  ]);
  if (projErr) { console.error('❌ Projects:', projErr.message); process.exit(1); }
  console.log('✅ 3 projects inserted');

  // ── VARIATIONS ───────────────────────────────────────────────────────────────
  console.log('\n🌱 Inserting variations...');

  const varData = [
    // Austin Health — 7 variations across the range of statuses
    { pid: p1, seq: 1,  title: 'Sprinkler zone extension — Level 6 addition',       src: 'drawing_revision',  val: 38400,  sts: 'paid',      by: 'Design Manager',        days: 38, due: null },
    { pid: p1, seq: 2,  title: 'Pump room access conflict — concrete relocation',    src: 'rfi_response',      val: 24750,  sts: 'approved',  by: 'Site Manager',          days: 30, due: null },
    { pid: p1, seq: 3,  title: 'Smoke detector relocation — services coordination', src: 'drawing_revision',  val: 12200,  sts: 'submitted', by: 'Mechanical Coordinator',days: 18, due: daysAhead(3) },
    { pid: p1, seq: 4,  title: 'Additional deluge system — loading dock',            src: 'site_instruction',  val: 31500,  sts: 'submitted', by: 'Project Manager',       days: 14, due: daysAhead(7) },
    { pid: p1, seq: 5,  title: 'Fire hydrant booster — revised hydraulic calc',      src: 'rfi_response',      val: 18900,  sts: 'disputed',  by: 'Fire Engineer',         days: 22, due: daysAhead(-3) },
    { pid: p1, seq: 6,  title: 'Penetration sealing — revised spec 30 to 120min',   src: 'drawing_revision',  val: 9800,   sts: 'draft',     by: 'BCA Consultant',        days: 8,  due: daysAhead(5) },
    { pid: p1, seq: 7,  title: 'Emergency lighting integration — fire panel interface', src: 'verbal_direction', val: 7400, sts: 'draft',    by: 'Electrical Contractor', days: 4,  due: daysAhead(10) },
    // CBD Parking Station — 4 variations
    { pid: p2, seq: 1,  title: 'FM200 cylinder bank relocation — structural clash',  src: 'rfi_response',      val: 14200,  sts: 'approved',  by: 'Structural Engineer',   days: 25, due: null },
    { pid: p2, seq: 2,  title: 'Additional suppression zones — ramp B extension',   src: 'site_instruction',  val: 22600,  sts: 'submitted', by: 'Site Superintendent',   days: 16, due: daysAhead(4) },
    { pid: p2, seq: 3,  title: 'Power supply modification — UPS specification',      src: 'drawing_revision',  val: 8300,   sts: 'disputed',  by: 'Electrical Engineer',   days: 20, due: daysAhead(-5) },
    { pid: p2, seq: 4,  title: 'Cable penetration sealing — basement level 2',      src: 'verbal_direction',  val: 5600,   sts: 'draft',     by: 'Project Manager',       days: 3,  due: daysAhead(12) },
    // Metro Tunnelling — 4 variations
    { pid: p3, seq: 1,  title: 'Tunnel ventilation interface — revised activation', src: 'drawing_revision',  val: 44800,  sts: 'submitted', by: 'Systems Engineer',      days: 15, due: daysAhead(2) },
    { pid: p3, seq: 2,  title: 'Cross-passage deluge — manual override requirement',src: 'rfi_response',      val: 28300,  sts: 'draft',     by: 'Fire Safety Engineer',  days: 10, due: daysAhead(8) },
    { pid: p3, seq: 3,  title: 'Sprinkler head relocation — OHW clearance',         src: 'site_instruction',  val: 16100,  sts: 'disputed',  by: 'Site Manager',          days: 12, due: daysAhead(-2) },
    { pid: p3, seq: 4,  title: 'Panel location change — emergency egress compliance',src: 'verbal_direction', val: 9200,   sts: 'draft',     by: 'Project Manager',       days: 5,  due: daysAhead(14) },
  ];

  const variations = varData.map(v => ({
    id: uid(),
    project_id: v.pid,
    sequence_number: v.seq,
    title: v.title,
    description: `Direction received on site regarding ${v.title.toLowerCase()}. Scope confirmed and costed. Supporting photos and documentation captured at time of instruction.`,
    instruction_source: v.src,
    instructed_by: v.by,
    estimated_value: v.val * 100, // cents
    status: v.sts,
    response_due_date: v.due,
    captured_at: daysAgo(v.days),
    created_at: daysAgo(v.days),
    updated_at: daysAgo(v.days),
  }));

  const { error: varErr } = await supabase.from('variations').insert(variations);
  if (varErr) { console.error('❌ Variations:', varErr.message); process.exit(1); }
  console.log('✅ 15 variations inserted');

  // ── VARIATION NOTICES ────────────────────────────────────────────────────────
  console.log('\n🌱 Inserting variation notices...');

  const notices = [
    {
      id: uid(), project_id: p1, company_id: companyId,
      notice_number: 'VN-001', sequence_number: 1,
      event_description: 'Superintendent issued verbal direction to extend sprinkler coverage to Level 6 east wing, not included in original contract scope.',
      event_date: daysAgo(40).slice(0,10),
      cost_flag: true, time_flag: false,
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Kai Richards', issued_by_email: DEMO_EMAIL,
      status: 'acknowledged',
      issued_at: daysAgo(38),
      acknowledged_at: daysAgo(36),
      created_at: daysAgo(40), updated_at: daysAgo(36),
    },
    {
      id: uid(), project_id: p1, company_id: companyId,
      notice_number: 'VN-002', sequence_number: 2,
      event_description: 'RFI response confirmed pump room concrete slab conflicts with GEM Fire pipe run. Relocation required at contractor cost per Principal.',
      event_date: daysAgo(32).slice(0,10),
      cost_flag: true, time_flag: true,
      estimated_days: 3,
      time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Kai Richards', issued_by_email: DEMO_EMAIL,
      status: 'issued',
      issued_at: daysAgo(30),
      response_due_date: daysAhead(0),
      created_at: daysAgo(32), updated_at: daysAgo(30),
    },
    {
      id: uid(), project_id: p3, company_id: companyId,
      notice_number: 'VN-001', sequence_number: 1,
      event_description: 'Systems Engineering revision to tunnel ventilation activation sequence requires changes to fire panel programming and sprinkler zone mapping. Additional scope not allowed for in contract.',
      event_date: daysAgo(16).slice(0,10),
      cost_flag: true, time_flag: true,
      estimated_days: 5,
      time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Kai Richards', issued_by_email: DEMO_EMAIL,
      status: 'draft',
      created_at: daysAgo(16), updated_at: daysAgo(15),
    },
  ];

  const { error: noticeErr } = await supabase.from('variation_notices').insert(notices);
  if (noticeErr) { console.error('❌ Notices:', noticeErr.message); process.exit(1); }
  console.log('✅ 3 variation notices inserted');

  console.log('\n✅ GEM Fire demo account ready.\n');
  console.log('   🔑 Email:    demo-gemfire@leveragedsystems.com.au');
  console.log('   🔑 Password: GemFireDemo2026!');
  console.log('   🏢 Company:  GEM Fire Protection');
  console.log('   📋 3 projects | 15 variations | 3 notices\n');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
