#!/usr/bin/env node
/**
 * setup-demo-vecta.js — Create / reset the Vecta Group demo account
 *
 * Usage:
 *   node setup-demo-vecta.js
 *
 * Login:
 *   Email:    demo-vecta@leveragedsystems.com.au
 *   Password: VectaDemo2026!
 *
 * Scenario: Vecta Group Services — brownfield / live-facility E&C contractor
 *   Projects: Alcoa shutdown, BP turnaround, ATCO gas station upgrade
 *   Reflects shutdown/brownfield environment: tight windows, high-value scope changes
 */

const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL   = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjE5NTEsImV4cCI6MjA4NzI5Nzk1MX0.f8DTWLnuITDS_SA42meoLwTCldqX34C7khm_zgjpP5o';

const DEMO_EMAIL    = 'demo-vecta@leveragedsystems.com.au';
const DEMO_PASSWORD = 'VectaDemo2026!';
const COMPANY_NAME  = 'Vecta Group Services';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

function uid()         { return randomUUID(); }
function daysAgo(n)    { return new Date(Date.now() - n * 86400000).toISOString(); }
function daysAhead(n)  { return new Date(Date.now() + n * 86400000).toISOString().slice(0,10); }

async function getOrCreateAccount() {
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
      data: { display_name: 'Alfred Quadrio', company_name: COMPANY_NAME },
    },
  });

  if (signUpError) { console.error('❌ Sign up failed:', signUpError.message); process.exit(1); }
  console.log('✅ Account created:', signUpData.user.email);

  const { error: provErr } = await supabase.rpc('provision_new_account', { p_company_id: uid(), p_company_name: COMPANY_NAME });
  if (provErr) console.warn('⚠️  provision_new_account:', provErr.message, '(may already exist)');
  else console.log('✅ Company provisioned:', COMPANY_NAME);

  const { data: reSignIn } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  return reSignIn.user;
}

async function run() {
  console.log('\n⚙️  Vecta Group Services — Demo Setup\n');

  const user = await getOrCreateAccount();
  if (!user) { console.error('❌ Could not get user'); process.exit(1); }

  const { data: members } = await supabase.from('company_members').select('company_id').eq('user_id', user.id).eq('is_active', true);
  if (!members?.length) { console.error('❌ No active company found'); process.exit(1); }
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
      name: 'Alcoa Wagerup — Shutdown T1-2026',
      client: 'Alcoa of Australia',
      reference: 'AWR-T1-2026',
      contract_type: 'lump_sum',
      is_active: true, notice_required: true,
      created_at: daysAgo(50), updated_at: daysAgo(50),
    },
    {
      id: p2, company_id: companyId, created_by: user.id,
      name: 'BP Kwinana Refinery — Turnaround TAR-26',
      client: 'BP Australia Pty Ltd',
      reference: 'BPK-TAR26',
      contract_type: 'schedule_of_rates',
      is_active: true, notice_required: true,
      created_at: daysAgo(35), updated_at: daysAgo(35),
    },
    {
      id: p3, company_id: companyId, created_by: user.id,
      name: 'ATCO Gas — Compressor Station Upgrade',
      client: 'ATCO Gas Australia',
      reference: 'ATCO-CS-2025',
      contract_type: 'design_and_construct',
      is_active: true, notice_required: false,
      created_at: daysAgo(22), updated_at: daysAgo(22),
    },
  ]);
  if (projErr) { console.error('❌ Projects:', projErr.message); process.exit(1); }
  console.log('✅ 3 projects inserted');

  // ── VARIATIONS ───────────────────────────────────────────────────────────────
  console.log('\n🌱 Inserting variations...');

  const varData = [
    // Alcoa Wagerup Shutdown — 7 variations (brownfield, time-critical)
    { pid: p1, seq: 1,  title: 'Additional isolation points — revised P&ID issue C',      src: 'drawing_revision', val: 48200,  sts: 'approved',  by: 'Engineering Lead',     days: 45, due: null },
    { pid: p1, seq: 2,  title: 'Unexpected corrosion — vessel nozzle replacement scope',  src: 'latent_condition', val: 124000, sts: 'submitted', by: 'Inspection Engineer',  days: 30, due: daysAhead(2) },
    { pid: p1, seq: 3,  title: 'Additional hydroblast — fouled heat exchanger bundle',    src: 'site_instruction', val: 31800,  sts: 'paid',      by: 'Operations Lead',      days: 42, due: null },
    { pid: p1, seq: 4,  title: 'Confined space rescue standby — extended duration',       src: 'verbal_direction', val: 22400,  sts: 'disputed',  by: 'Site Superintendent',  days: 28, due: daysAhead(-4) },
    { pid: p1, seq: 5,  title: 'Revised work pack — additional inspection hold points',   src: 'rfi_response',     val: 18600,  sts: 'submitted', by: 'QA Engineer',          days: 20, due: daysAhead(5) },
    { pid: p1, seq: 6,  title: 'Scaffold extension — access for corroded pipework',       src: 'site_instruction', val: 15200,  sts: 'disputed',  by: 'Project Manager',      days: 18, due: daysAhead(-1) },
    { pid: p1, seq: 7,  title: 'HAZOP close-out action — additional relief valve',        src: 'rfi_response',     val: 29400,  sts: 'draft',     by: 'Process Engineer',     days: 8,  due: daysAhead(10) },
    // BP Kwinana Turnaround — 5 variations
    { pid: p2, seq: 1,  title: 'Scaffold hire overrun — programme extension week 3',      src: 'site_instruction', val: 38700,  sts: 'submitted', by: 'Construction Manager', days: 25, due: daysAhead(3) },
    { pid: p2, seq: 2,  title: 'Valve replacement scope increase — seat erosion found',   src: 'latent_condition', val: 87500,  sts: 'submitted', by: 'Mechanical Engineer',  days: 20, due: daysAhead(7) },
    { pid: p2, seq: 3,  title: 'P&ID discrepancy — additional tie-in points',             src: 'drawing_revision', val: 62300,  sts: 'disputed',  by: 'Engineering Lead',     days: 22, due: daysAhead(-2) },
    { pid: p2, seq: 4,  title: 'Hydro-test extension — failed acceptance criteria',       src: 'rfi_response',     val: 19800,  sts: 'draft',     by: 'QA Supervisor',        days: 6,  due: daysAhead(8) },
    { pid: p2, seq: 5,  title: 'Night shift premium — critical path overrun',             src: 'verbal_direction', val: 44200,  sts: 'draft',     by: 'Project Manager',      days: 4,  due: daysAhead(12) },
    // ATCO Gas Compressor — 4 variations
    { pid: p3, seq: 1,  title: 'Civil scope increase — revised foundation design',        src: 'drawing_revision', val: 33600,  sts: 'approved',  by: 'Civil Engineer',       days: 18, due: null },
    { pid: p3, seq: 2,  title: 'Vendor equipment interface — additional hook-up scope',   src: 'rfi_response',     val: 28100,  sts: 'submitted', by: 'Commissioning Lead',   days: 14, due: daysAhead(4) },
    { pid: p3, seq: 3,  title: 'Pre-commissioning inspection — additional scope items',   src: 'site_instruction', val: 16400,  sts: 'draft',     by: 'Operations Manager',   days: 7,  due: daysAhead(9) },
    { pid: p3, seq: 4,  title: 'Grounding system upgrade — revised earthing standard',    src: 'drawing_revision', val: 11200,  sts: 'draft',     by: 'Electrical Engineer',  days: 3,  due: daysAhead(15) },
  ];

  const variations = varData.map(v => ({
    id: uid(),
    project_id: v.pid,
    sequence_number: v.seq,
    title: v.title,
    description: `Scope change identified during ${v.pid === p1 ? 'Alcoa Wagerup T1 shutdown' : v.pid === p2 ? 'BP Kwinana TAR-26 turnaround' : 'ATCO compressor station upgrade'}. Direction received on site from ${v.by}. Cost and programme impact documented at time of instruction.`,
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
  console.log('✅ 16 variations inserted');

  // ── VARIATION NOTICES ────────────────────────────────────────────────────────
  console.log('\n🌱 Inserting variation notices...');

  const notices = [
    {
      id: uid(), project_id: p1, company_id: companyId,
      notice_number: 'VN-001', sequence_number: 1,
      event_description: 'Alcoa Engineering issued revised P&ID (Issue C) during shutdown window. Changes include 4 additional isolation points on the 6" process line not included in original scope.',
      event_date: daysAgo(46).slice(0,10),
      cost_flag: true, time_flag: true,
      estimated_days: 2, time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Alfred Quadrio', issued_by_email: DEMO_EMAIL,
      status: 'acknowledged',
      issued_at: daysAgo(45), acknowledged_at: daysAgo(44),
      created_at: daysAgo(46), updated_at: daysAgo(44),
    },
    {
      id: uid(), project_id: p1, company_id: companyId,
      notice_number: 'VN-002', sequence_number: 2,
      event_description: 'Inspection of vessel V-201 nozzle N4 revealed corrosion beyond acceptance criteria. Operations lead directed Vecta to scope and price full nozzle replacement during current shutdown window to avoid unit deferment.',
      event_date: daysAgo(31).slice(0,10),
      cost_flag: true, time_flag: true,
      estimated_days: 4, time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Alfred Quadrio', issued_by_email: DEMO_EMAIL,
      status: 'issued',
      issued_at: daysAgo(30),
      response_due_date: daysAhead(2),
      created_at: daysAgo(31), updated_at: daysAgo(30),
    },
    {
      id: uid(), project_id: p2, company_id: companyId,
      notice_number: 'VN-001', sequence_number: 1,
      event_description: 'Turnaround programme extended by 5 days due to critical path activities. BP Construction Manager verbally directed Vecta to continue night shift operations. Premium rates apply from Day 16 of the turnaround.',
      event_date: daysAgo(22).slice(0,10),
      cost_flag: true, time_flag: false,
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Alfred Quadrio', issued_by_email: DEMO_EMAIL,
      status: 'issued',
      issued_at: daysAgo(20),
      response_due_date: daysAhead(-2),
      created_at: daysAgo(22), updated_at: daysAgo(20),
    },
  ];

  const { error: noticeErr } = await supabase.from('variation_notices').insert(notices);
  if (noticeErr) { console.error('❌ Notices:', noticeErr.message); process.exit(1); }
  console.log('✅ 3 variation notices inserted');

  console.log('\n✅ Vecta Group demo account ready.\n');
  console.log('   🔑 Email:    demo-vecta@leveragedsystems.com.au');
  console.log('   🔑 Password: VectaDemo2026!');
  console.log('   🏢 Company:  Vecta Group Services');
  console.log('   📋 3 projects | 16 variations | 3 notices\n');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
