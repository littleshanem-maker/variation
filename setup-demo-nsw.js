/**
 * setup-demo-nsw.js — Create / reset the NSW Construction demo account
 *
 * Usage:
 *   node setup-demo-nsw.js
 *
 * Login:
 *   Email:    demo-blackstone@leveragedsystems.com.au
 *   Password: BlackstoneDemo2026!
 *
 * Scenario: Blackstone Services NSW — commercial / residential construction contractor
 *   Projects: 4 NSW-based commercial projects
 *   Focus: mixed-use, health, aged care, infrastructure
 */

const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL   = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjE5NTEsImV4cCI6MjA4NzI5Nzk1MX0.f8DTWLnuITDS_SA42meoLwTCldqX34C7khm_zgjpP5o';

const DEMO_EMAIL    = 'demo-blackstone@leveragedsystems.com.au';
const DEMO_PASSWORD = 'BlackstoneDemo2026!';
const COMPANY_NAME  = 'Blackstone Services NSW';

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
    const { data: members } = await supabase.from('company_members').select('company_id').eq('user_id', signInData.user.id);
    if (!members?.length) {
      console.log('⚠️  No company found — provisioning...');
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
      data: { display_name: 'Marcus Reid', company_name: COMPANY_NAME },
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
  console.log('\n⚙️  Blackstone Services NSW — Demo Setup\n');

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

  const p1 = uid(), p2 = uid(), p3 = uid(), p4 = uid();

  const { error: projErr } = await supabase.from('projects').insert([
    {
      id: p1, company_id: companyId, created_by: user.id,
      name: 'Penrith Civic Centre — Stage 2 Fit-Out',
      client: 'Penrith City Council',
      reference: 'PCC-CIV-2025-02',
      address: '601 High Street, Penrith NSW 2750',
      contract_type: 'lump_sum',
      is_active: true, notice_required: true,
      created_at: daysAgo(60), updated_at: daysAgo(60),
    },
    {
      id: p2, company_id: companyId, created_by: user.id,
      name: 'Sydney Olympic Park — Mixed-Use Tower (Stages 3 & 4)',
      client: 'Meridian Property Group',
      reference: 'MGS-SOP-2025',
      address: '8 Sarah Street, Sydney Olympic Park NSW 2127',
      contract_type: 'lump_sum',
      is_active: true, notice_required: true,
      created_at: daysAgo(40), updated_at: daysAgo(40),
    },
    {
      id: p3, company_id: companyId, created_by: user.id,
      name: 'Westmead Private Hospital — Ward Refurbishment',
      client: 'Westmead Private Hospital Pty Ltd',
      reference: 'WPH-WR-2026',
      address: '12 Mons Road, Westmead NSW 2145',
      contract_type: 'cost_plus',
      is_active: true, notice_required: true,
      created_at: daysAgo(25), updated_at: daysAgo(25),
    },
    {
      id: p4, company_id: companyId, created_by: user.id,
      name: 'Newcastle Freight Hub — Civil & Structural Package',
      client: 'Pacific National Pty Ltd',
      reference: 'PN-NFH-2026',
      address: '23 Industrial Drive, Hexham NSW 2322',
      contract_type: 'schedule_of_rates',
      is_active: true, notice_required: true,
      created_at: daysAgo(18), updated_at: daysAgo(18),
    },
  ]);
  if (projErr) { console.error('❌ Projects:', projErr.message); process.exit(1); }
  console.log('✅ 4 projects inserted');

  // ── VARIATIONS ───────────────────────────────────────────────────────────────
  console.log('\n🌱 Inserting variations...');

  const varData = [
    // Penrith Civic Centre — 6 variations
    { pid: p1, seq: 1,  title: 'Additional structural steel — revised ceiling loadings',          src: 'drawing_revision', val: 67800,  sts: 'approved',  by: 'Structural Engineer',    days: 55, due: null },
    { pid: p1, seq: 2,  title: 'Lift pit waterproofing — latent ground water condition',         src: 'latent_condition', val: 34200,  sts: 'submitted', by: 'Site Supervisor',        days: 38, due: daysAhead(3) },
    { pid: p1, seq: 3,  title: 'Additional fire compartmentation — revised BCA assessment',       src: 'site_instruction', val: 22100,  sts: 'disputed',  by: 'Building Surveyor',       days: 30, due: daysAhead(-3) },
    { pid: p1, seq: 4,  title: 'Acoustic wall insulation upgrade — specification change',       src: 'drawing_revision', val: 18400,  sts: 'paid',      by: 'Contracts Administrator', days: 28, due: null },
    { pid: p1, seq: 5,  title: 'HVAC rebalancing — revised diffuser locations',               src: 'rfi_response',    val: 12700,  sts: 'draft',     by: 'M&E Consultant',         days: 12, due: daysAhead(10) },
    // Sydney Olympic Park — 5 variations
    { pid: p2, seq: 1,  title: 'Deep soil zone amendment — structurally inadequate fill',       src: 'latent_condition', val: 112000, sts: 'submitted', by: 'Geotechnical Engineer',  days: 35, due: daysAhead(5) },
    { pid: p2, seq: 2,  title: 'Facade scope increase — revised architectural intent',         src: 'drawing_revision', val: 89500,  sts: 'disputed',  by: 'Architect',               days: 28, due: daysAhead(-5) },
    { pid: p2, seq: 3,  title: 'Basement waterproofing — changed water table assumption',     src: 'latent_condition', val: 47300,  sts: 'submitted', by: 'Structural Engineer',    days: 20, due: daysAhead(2) },
    { pid: p2, seq: 4,  title: 'Signage package — additional tenancy identification signs',     src: 'site_instruction', val: 15800,  sts: 'paid',      by: 'Project Manager',        days: 15, due: null },
    { pid: p2, seq: 5,  title: 'Vertical transport — revised lift shaft dimensions',           src: 'drawing_revision', val: 36400,  sts: 'draft',     by: 'Services Engineer',      days: 8,  due: daysAhead(12) },
    // Westmead Hospital — 4 variations
    { pid: p3, seq: 1,  title: 'Asbestos-containing material — floor tiles in Stage 3 area',  src: 'latent_condition', val: 54800,  sts: 'approved',  by: 'Hazardous Materials Consultant', days: 22, due: null },
    { pid: p3, seq: 2,  title: 'Head contractor direction — revised patient flow routing',    src: 'site_instruction', val: 21300,  sts: 'submitted', by: 'Hospital Operations',    days: 14, due: daysAhead(4) },
    { pid: p3, seq: 3,  title: 'Medical gas infrastructure upgrade — revised MHWS scope',     src: 'site_instruction', val: 38700,  sts: 'draft',     by: 'Medical Gas Engineer',   days: 6,  due: daysAhead(8) },
    // Newcastle Freight Hub — 3 variations
    { pid: p4, seq: 1,  title: 'Unforeseen rock formation — basement excavation',              src: 'latent_condition', val: 143000, sts: 'disputed',  by: 'Site Supervisor',        days: 12, due: daysAhead(-2) },
    { pid: p4, seq: 2,  title: 'Pacific Highway tie-in — scope increase at northern boundary',src: 'site_instruction', val: 52400,  sts: 'submitted', by: 'Project Engineer',       days: 8,  due: daysAhead(3) },
    { pid: p4, seq: 3,  title: 'Stormwater easement — revised DOT requirements',              src: 'rfi_response',    val: 18900,  sts: 'draft',     by: 'Civil Engineer',         days: 5,  due: daysAhead(9) },
  ];

  const projectNames = {
    [p1]: 'Penrith Civic Centre Stage 2 Fit-Out',
    [p2]: 'Sydney Olympic Park Mixed-Use Tower Stages 3 & 4',
    [p3]: 'Westmead Private Hospital Ward Refurbishment',
    [p4]: 'Newcastle Freight Hub Civil & Structural Package',
  };

  const variations = varData.map(v => ({
    id: uid(),
    project_id: v.pid,
    sequence_number: v.seq,
    title: v.title,
    description: `Scope change identified during ${projectNames[v.pid]}. Instruction received from ${v.by} on site. Cost and programme impact documented at time of direction.`,
    instruction_source: v.src,
    instructed_by: v.by,
    estimated_value: v.val * 100,
    status: v.sts,
    response_due_date: v.due,
    captured_at: daysAgo(v.days),
    created_at: daysAgo(v.days),
    updated_at: daysAgo(v.days),
  }));

  const { error: varErr } = await supabase.from('variations').insert(variations);
  if (varErr) { console.error('❌ Variations:', varErr.message); process.exit(1); }
  console.log('✅ 18 variations inserted');

  // ── VARIATION NOTICES ────────────────────────────────────────────────────────
  console.log('\n🌱 Inserting variation notices...');

  const notices = [
    {
      id: uid(), project_id: p1, company_id: companyId,
      notice_number: 'VN-001', sequence_number: 1,
      event_description: 'Structural engineer issued revised structural drawings (Issue D) for Levels 3 and 4. Additional steel members required at transfer slab due to revised occupancy loading on Level 4. Scope not included in tender documents.',
      event_date: daysAgo(56).slice(0,10),
      cost_flag: true, time_flag: true,
      estimated_days: 3, time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Marcus Reid', issued_by_email: DEMO_EMAIL,
      status: 'acknowledged',
      issued_at: daysAgo(55), acknowledged_at: daysAgo(53),
      created_at: daysAgo(56), updated_at: daysAgo(53),
    },
    {
      id: uid(), project_id: p1, company_id: companyId,
      notice_number: 'VN-002', sequence_number: 2,
      event_description: 'Seepage observed in basement Level 2 during excavation for lift pit. Ground water conditions differ from geotechnical report assumptions. Specialist waterproofing subcontractor engaged. Direction received from structural engineer to proceed with remedial works.',
      event_date: daysAgo(39).slice(0,10),
      cost_flag: true, time_flag: true,
      estimated_days: 5, time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Marcus Reid', issued_by_email: DEMO_EMAIL,
      status: 'issued',
      issued_at: daysAgo(38),
      response_due_date: daysAhead(3),
      created_at: daysAgo(39), updated_at: daysAgo(38),
    },
    {
      id: uid(), project_id: p2, company_id: companyId,
      notice_number: 'VN-001', sequence_number: 1,
      event_description: 'Geotechnical report issued for Stages 3 and 4 reveals fill material across northern basement zone is structurally inadequate for specified pile loads. Import of suitable fill material required, or alternative deep foundation solution. Direction from structural engineer to price both options.',
      event_date: daysAgo(36).slice(0,10),
      cost_flag: true, time_flag: true,
      estimated_days: 6, time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Marcus Reid', issued_by_email: DEMO_EMAIL,
      status: 'issued',
      issued_at: daysAgo(35),
      response_due_date: daysAhead(5),
      created_at: daysAgo(36), updated_at: daysAgo(35),
    },
    {
      id: uid(), project_id: p3, company_id: companyId,
      notice_number: 'VN-001', sequence_number: 1,
      event_description: 'Asbestos-containing material identified in floor tiles in Level 2 east wing. Area declared restricted zone. Licensed asbestos removal contractor engaged under emergency procurement provisions. Scope of removal beyond original contract scope. Direction received from hospital operations manager.',
      event_date: daysAgo(23).slice(0,10),
      cost_flag: true, time_flag: true,
      estimated_days: 4, time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Marcus Reid', issued_by_email: DEMO_EMAIL,
      status: 'acknowledged',
      issued_at: daysAgo(22), acknowledged_at: daysAgo(20),
      created_at: daysAgo(23), updated_at: daysAgo(20),
    },
    {
      id: uid(), project_id: p4, company_id: companyId,
      notice_number: 'VN-001', sequence_number: 1,
      event_description: 'Excavation to founding level encountered unexpected rock formation at RL 8.2, approximately 1.8m above design founding level. Blasting and rock-breaking required. Direction received from structural engineer to proceed. Programme impact of 4 days estimated.',
      event_date: daysAgo(13).slice(0,10),
      cost_flag: true, time_flag: true,
      estimated_days: 4, time_implication_unit: 'days',
      contract_clause: 'AS 4000-1997 Clause 36',
      issued_by_name: 'Marcus Reid', issued_by_email: DEMO_EMAIL,
      status: 'issued',
      issued_at: daysAgo(12),
      response_due_date: daysAhead(-2),
      created_at: daysAgo(13), updated_at: daysAgo(12),
    },
  ];

  const { error: noticeErr } = await supabase.from('variation_notices').insert(notices);
  if (noticeErr) { console.error('❌ Notices:', noticeErr.message); process.exit(1); }
  console.log('✅ 5 variation notices inserted');

  console.log('\n✅ Blackstone Services NSW demo account ready.\n');
  console.log('   🔑 Email:    demo-blackstone@leveragedsystems.com.au');
  console.log('   🔑 Password: BlackstoneDemo2026!');
  console.log('   🏢 Company:  Blackstone Services NSW');
  console.log('   📋 4 projects | 18 variations | 5 notices\n');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
