#!/usr/bin/env node
/**
 * setup-demo-mechciv.js — Create / reset the MechCiv Pty Ltd demo account
 *
 * Usage:
 *   node setup-demo-mechciv.js
 *
 * Login:
 *   Email:    demo-mechciv@leveragedsystems.com.au
 *   Password: MechCivDemo2026!
 *
 * Scenario: MechCiv Pty Ltd — civil & mechanical subcontractor
 *   Projects: water treatment plant mechanical, highway drainage civil, industrial HVAC
 *   Mix of statuses, realistic civil/mechanical scope change language
 */

const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL   = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjE5NTEsImV4cCI6MjA4NzI5Nzk1MX0.f8DTWLnuITDS_SA42meoLwTCldqX34C7khm_zgjpP5o';

const DEMO_EMAIL    = 'demo-mechciv@leveragedsystems.com.au';
const DEMO_PASSWORD = 'MechCivDemo2026!';
const COMPANY_NAME  = 'MechCiv Pty Ltd';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

function uid()        { return randomUUID(); }
function daysAgo(n)   { return new Date(Date.now() - n * 86400000).toISOString(); }
function daysAhead(n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

async function getOrCreateAccount() {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  if (!signInError) {
    console.log('✅ Signed in as existing demo user');
    const { data: members } = await supabase.from('company_members').select('company_id').eq('user_id', signInData.user.id);
    if (!members?.length) {
      const { error: provErr } = await supabase.rpc('provision_new_account', { p_company_id: uid(), p_company_name: COMPANY_NAME });
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
      data: { full_name: 'Dave Morrow', display_name: 'Dave Morrow', company_name: COMPANY_NAME },
    },
  });
  if (signUpError) { console.error('❌ Sign up failed:', signUpError.message); process.exit(1); }
  console.log('✅ Account created');

  const { error: provErr } = await supabase.rpc('provision_new_account', { p_company_id: uid(), p_company_name: COMPANY_NAME });
  if (provErr) console.warn('⚠️  provision:', provErr.message);
  else console.log('✅ Company provisioned:', COMPANY_NAME);

  const { data: reSignIn } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  return reSignIn.user;
}

async function run() {
  console.log('\n⚙️  MechCiv Pty Ltd — Demo Setup\n');

  const user = await getOrCreateAccount();
  if (!user) { console.error('❌ Could not get user'); process.exit(1); }

  const { data: members } = await supabase.from('company_members').select('company_id').eq('user_id', user.id);
  if (!members?.length) { console.error('❌ No company found'); process.exit(1); }
  const companyId = members[0].company_id;
  console.log('🏢 Company ID:', companyId);

  // ── DELETE ───────────────────────────────────────────────────────────────────
  console.log('\n🗑️  Clearing existing data...');
  const { data: existingProjects } = await supabase.from('projects').select('id').eq('company_id', companyId);
  const existingIds = existingProjects?.map(p => p.id) || [];
  if (existingIds.length > 0) {
    await supabase.from('variation_notices').delete().in('project_id', existingIds);
    const { data: vars } = await supabase.from('variations').select('id').in('project_id', existingIds);
    if (vars?.length) {
      const varIds = vars.map(v => v.id);
      await supabase.from('status_changes').delete().in('variation_id', varIds);
      await supabase.from('variation_revisions').delete().in('variation_id', varIds);
    }
    await supabase.from('variations').delete().in('project_id', existingIds);
  }
  await supabase.from('projects').delete().eq('company_id', companyId);
  console.log('✅ Cleared');

  // ── PROJECTS ─────────────────────────────────────────────────────────────────
  console.log('\n🌱 Inserting projects...');

  const p1 = uid(), p2 = uid(), p3 = uid();

  const { error: projErr } = await supabase.from('projects').insert([
    {
      id: p1, company_id: companyId, created_by: user.id,
      name: 'Winneke Water Treatment — Mechanical Upgrade',
      client: 'John Holland Group',
      reference: 'WWT-MECH-2025',
      contract_type: 'lump_sum',
      is_active: true, notice_required: true,
      created_at: daysAgo(55), updated_at: daysAgo(55),
    },
    {
      id: p2, company_id: companyId, created_by: user.id,
      name: 'Western Ring Road — Drainage & Civil Works',
      client: 'CPB Contractors',
      reference: 'WRR-DRAIN-047',
      contract_type: 'schedule_of_rates',
      is_active: true, notice_required: true,
      created_at: daysAgo(35), updated_at: daysAgo(35),
    },
    {
      id: p3, company_id: companyId, created_by: user.id,
      name: 'Laverton Industrial Hub — HVAC & Mechanical',
      client: 'Probuild',
      reference: 'LIH-HVAC-2025',
      contract_type: 'lump_sum',
      is_active: true, notice_required: false,
      created_at: daysAgo(22), updated_at: daysAgo(22),
    },
  ]);
  if (projErr) { console.error('❌ Projects:', projErr.message); process.exit(1); }
  console.log('✅ 3 projects inserted');

  // ── VARIATIONS ───────────────────────────────────────────────────────────────
  console.log('\n🌱 Inserting variations...');

  const varData = [
    // Winneke Water Treatment — 7 variations
    { pid: p1, seq: 1,  title: 'Pump station relocation — foundation conflict with existing services',   src: 'drawing_revision',  val: 52400, sts: 'paid',      by: 'Structural Engineer',    days: 50, due: null },
    { pid: p1, seq: 2,  title: 'Chemical dosing skid — revised layout for maintenance access',           src: 'rfi_response',      val: 34700, sts: 'approved',  by: 'Process Engineer',       days: 42, due: null },
    { pid: p1, seq: 3,  title: 'Pipe support modifications — seismic zone reclassification',             src: 'drawing_revision',  val: 21300, sts: 'approved',  by: 'Structural Engineer',    days: 35, due: null },
    { pid: p1, seq: 4,  title: 'Additional isolation valves — ops shutdown requirement',                 src: 'site_instruction',  val: 16800, sts: 'submitted', by: 'Operations Manager',     days: 20, due: daysAhead(4) },
    { pid: p1, seq: 5,  title: 'Mechanical room ventilation — revised air change rate',                  src: 'drawing_revision',  val: 12400, sts: 'submitted', by: 'Mechanical Engineer',    days: 15, due: daysAhead(7) },
    { pid: p1, seq: 6,  title: 'Concrete plinth heights — survey peg conflict with installed plant',     src: 'verbal_direction',  val: 8900,  sts: 'disputed',  by: 'Site Superintendent',    days: 28, due: daysAhead(-4) },
    { pid: p1, seq: 7,  title: 'Electrical interface — additional MCC terminations',                     src: 'rfi_response',      val: 7200,  sts: 'draft',     by: 'Electrical Engineer',    days: 8,  due: daysAhead(9) },
    // Western Ring Road — 5 variations
    { pid: p2, seq: 1,  title: 'Subsurface rock — unexpected excavation requirements Chainage 1+420',   src: 'site_instruction',  val: 68900, sts: 'submitted', by: 'Site Manager',           days: 28, due: daysAhead(3) },
    { pid: p2, seq: 2,  title: 'Detention basin grade change — revised batter slopes and lining',        src: 'drawing_revision',  val: 41200, sts: 'disputed',  by: 'Civil Engineer',         days: 22, due: daysAhead(-6) },
    { pid: p2, seq: 3,  title: 'Inlet structure modification — hydraulic model update',                  src: 'rfi_response',      val: 23600, sts: 'approved',  by: 'Hydraulics Engineer',    days: 18, due: null },
    { pid: p2, seq: 4,  title: 'Erosion protection upgrade — class 3 rock to class 5',                  src: 'drawing_revision',  val: 15300, sts: 'submitted', by: 'Environmental Engineer', days: 12, due: daysAhead(5) },
    { pid: p2, seq: 5,  title: 'Traffic management — extended duration due to service relocations',      src: 'verbal_direction',  val: 9400,  sts: 'draft',     by: 'Project Manager',        days: 6,  due: daysAhead(11) },
    // Laverton HVAC — 4 variations
    { pid: p3, seq: 1,  title: 'AHU relocation — structural steel conflict Level 3',                    src: 'drawing_revision',  val: 28700, sts: 'submitted', by: 'Structural Coordinator', days: 18, due: daysAhead(2) },
    { pid: p3, seq: 2,  title: 'Ductwork re-route — sprinkler installation conflict',                    src: 'site_instruction',  val: 17400, sts: 'disputed',  by: 'Hydraulics Coordinator', days: 14, due: daysAhead(-3) },
    { pid: p3, seq: 3,  title: 'Additional smoke exhaust fan — BCA non-compliance in revised layout',   src: 'rfi_response',      val: 24100, sts: 'draft',     by: 'BCA Consultant',         days: 9,  due: daysAhead(8) },
    { pid: p3, seq: 4,  title: 'Condensate drainage — additional floor waste required by plumber',      src: 'verbal_direction',  val: 5800,  sts: 'draft',     by: 'Plumbing Contractor',    days: 4,  due: daysAhead(13) },
  ];

  const costLineItems = {
    0: [{ description: 'Labour — pump station relocation',    quantity: 48,   unit: 'hr',  unit_rate: 750,  total: 36000 }, { description: 'Materials — additional concrete and formwork', quantity: 1, unit: 'lump', unit_rate: 16400, total: 16400 }],
    7: [{ description: 'Rock breaking and excavation',       quantity: 185,  unit: 'm³',  unit_rate: 280,  total: 51800 }, { description: 'Disposal — trucking and tipping',              quantity: 185, unit: 'm³', unit_rate: 93,   total: 17205 }],
  };

  const variations = varData.map((v, i) => ({
    id: uid(),
    project_id: v.pid,
    sequence_number: v.seq,
    title: v.title,
    description: `Direction received regarding ${v.title.toLowerCase()}. Scope change confirmed as additional to original contract. Cost and time implications documented at time of instruction.`,
    instruction_source: v.src,
    instructed_by: v.by,
    estimated_value: v.val * 100,
    status: v.sts,
    response_due_date: v.due,
    cost_items: costLineItems[i] || [],
    captured_at: daysAgo(v.days),
    created_at: daysAgo(v.days),
    updated_at: daysAgo(v.days),
  }));

  const { error: varErr } = await supabase.from('variations').insert(variations);
  if (varErr) { console.error('❌ Variations:', varErr.message); process.exit(1); }
  console.log(`✅ ${variations.length} variations inserted`);

  // ── VARIATION NOTICES ────────────────────────────────────────────────────────
  console.log('\n🌱 Inserting variation notices...');

  const notices = [
    {
      id: uid(), project_id: p1, company_id: companyId,
      notice_number: 'VN-001', sequence_number: 1,
      event_description: 'John Holland site superintendent directed MechCiv to relocate pump station P-03 approximately 4m east to clear conflict with existing uncharted services. Direction given verbally on site, confirmed by email same day.',
      event_date: daysAgo(52).slice(0, 10),
      cost_flag: true, time_flag: true,
      estimated_days: 4, time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Dave Morrow', issued_by_email: DEMO_EMAIL,
      status: 'acknowledged',
      issued_at: daysAgo(50),
      acknowledged_at: daysAgo(48),
      created_at: daysAgo(52), updated_at: daysAgo(48),
    },
    {
      id: uid(), project_id: p2, company_id: companyId,
      notice_number: 'VN-001', sequence_number: 1,
      event_description: 'Unexpected rock encountered at Chainage 1+420 during drainage trench excavation. Rock class R3-R4, not indicated in geotechnical report. CPB site manager directed works to continue with rock breaker. All additional plant, labour and disposal costs to be recorded.',
      event_date: daysAgo(30).slice(0, 10),
      cost_flag: true, time_flag: true,
      estimated_days: 6, time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Dave Morrow', issued_by_email: DEMO_EMAIL,
      status: 'issued',
      issued_at: daysAgo(28),
      response_due_date: daysAhead(3),
      created_at: daysAgo(30), updated_at: daysAgo(28),
    },
    {
      id: uid(), project_id: p2, company_id: companyId,
      notice_number: 'VN-002', sequence_number: 2,
      event_description: 'Hydraulic model update issued by Probuild engineering team requires detention basin batter slopes revised from 1:3 to 1:2.5 and lining class upgraded. Scope change not included in original contract drawings Rev C.',
      event_date: daysAgo(24).slice(0, 10),
      cost_flag: true, time_flag: false,
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Dave Morrow', issued_by_email: DEMO_EMAIL,
      status: 'draft',
      created_at: daysAgo(24), updated_at: daysAgo(23),
    },
    {
      id: uid(), project_id: p3, company_id: companyId,
      notice_number: 'VN-001', sequence_number: 1,
      event_description: 'Probuild structural coordinator issued direction to relocate AHU-L3-01 approximately 1.8m north to clear new structural beam not shown on mechanical coordination drawings. Additional ductwork, flexible connections and support steelwork required.',
      event_date: daysAgo(19).slice(0, 10),
      cost_flag: true, time_flag: true,
      estimated_days: 3, time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Dave Morrow', issued_by_email: DEMO_EMAIL,
      status: 'issued',
      issued_at: daysAgo(18),
      response_due_date: daysAhead(2),
      created_at: daysAgo(19), updated_at: daysAgo(18),
    },
  ];

  const { error: noticeErr } = await supabase.from('variation_notices').insert(notices);
  if (noticeErr) { console.error('❌ Notices:', noticeErr.message); process.exit(1); }
  console.log(`✅ ${notices.length} variation notices inserted`);

  console.log('\n✅ MechCiv Pty Ltd demo account ready.\n');
  console.log('   🔑 Email:    ' + DEMO_EMAIL);
  console.log('   🔑 Password: ' + DEMO_PASSWORD);
  console.log('   🏢 Company:  ' + COMPANY_NAME);
  console.log(`   📋 3 projects | ${variations.length} variations | ${notices.length} notices\n`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
