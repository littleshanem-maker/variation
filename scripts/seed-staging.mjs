#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const env = process.env.NEXT_PUBLIC_DEPLOY_ENV || process.env.VERCEL_ENV || '';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!['staging', 'preview', 'v2', 'development'].includes(env)) {
  console.error(`Refusing to seed: NEXT_PUBLIC_DEPLOY_ENV/VERCEL_ENV is "${env}". Set it to staging.`);
  process.exit(1);
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load web/.env.staging first.');
  process.exit(1);
}

if (/ketidyzumcdxditjfruk/i.test(supabaseUrl) || /variationshield\.com\.au/i.test(supabaseUrl)) {
  console.error('Refusing to seed: Supabase URL looks like production. Use a separate staging Supabase project.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const password = process.env.STAGING_DEMO_PASSWORD || `VsDemo-${crypto.randomBytes(4).toString('hex')}!`;
const companyId = '00000000-0000-4000-8000-000000000100';
const users = [
  { email: 'manager@staging.variationshield.com.au', name: 'Mia Parker', role: 'admin' },
  { email: 'supervisor@staging.variationshield.com.au', name: 'Tom Keane', role: 'field' },
  { email: 'office@staging.variationshield.com.au', name: 'Priya Shah', role: 'office' },
];

const projects = [
  { id: '00000000-0000-4000-8000-000000001001', name: 'Geelong Hospital Plantroom Upgrade', client: 'Barwon Health / BuildCore Projects', reference: 'BH-GPU-24', address: 'Ryrie Street, Geelong VIC', contract_type: 'AS 4000', contract_number: 'AS4000-24-017', client_email: 'pm@buildcore.example' },
  { id: '00000000-0000-4000-8000-000000001002', name: 'Docklands Office Fitout — Level 12', client: 'Harbour Commercial Builders', reference: 'HCB-L12-FO', address: 'Collins Street, Docklands VIC', contract_type: 'Design & Construct', contract_number: 'D&C-2408', client_email: 'contracts@harbourcommercial.example' },
  { id: '00000000-0000-4000-8000-000000001003', name: 'Ballarat Aquatic Centre Refurbishment', client: 'Regional Projects Victoria', reference: 'BAC-MECH-25', address: 'Gillies Street North, Ballarat VIC', contract_type: 'AS 2124', contract_number: 'AS2124-BAC-09', client_email: 'siteadmin@rpv.example' },
  { id: '00000000-0000-4000-8000-000000001004', name: 'Werribee Logistics Warehouse', client: 'Westside Industrial', reference: 'WI-WLW-01', address: 'Dohertys Road, Werribee VIC', contract_type: 'Construct Only', contract_number: 'CO-25-004', client_email: 'commercial@westside.example' },
];

const now = new Date();
const iso = (days) => new Date(now.getTime() + days * 86400000).toISOString();
const date = (days) => iso(days).slice(0, 10);

const variations = [
  { project_id: projects[0].id, sequence_number: 1, variation_number: 'VAR-001', title: 'After-hours shutdown for live hospital changeover', description: 'Client requested works be completed outside normal hours to keep critical services operational.', instruction_source: 'Site instruction', instructed_by: 'Alex Chen, BuildCore PM', estimated_value: 1875000, status: 'draft', captured_at: iso(-18), response_due_date: date(7), requestor_name: 'Mia Parker', requestor_email: users[0].email, client_email: projects[0].client_email, claim_type: 'cost_plus', basis_of_valuation: 'reasonable_rates', cost_items: [{ id: 'ci-001', description: 'Night shift labour crew', qty: 2, unit: 'shift', rate: 6250, total: 12500 }, { id: 'ci-002', description: 'Temporary shutdown coordination', qty: 1, unit: 'item', rate: 6250, total: 6250 }] },
  { project_id: projects[1].id, sequence_number: 2, variation_number: 'VAR-002', title: 'Additional condenser water pipework due to ceiling clash', description: 'Relocation required after structural beam conflict identified during setout.', instruction_source: 'RFI response', instructed_by: 'Harbour Commercial design manager', estimated_value: 4268000, status: 'submitted', captured_at: iso(-12), response_due_date: date(3), requestor_name: 'Priya Shah', requestor_email: users[2].email, client_email: projects[1].client_email, claim_type: 'cost_and_time', eot_days_claimed: 2, basis_of_valuation: 'contract_rates', approval_token: crypto.randomUUID(), approval_token_expires_at: iso(14) },
  { project_id: projects[2].id, sequence_number: 3, variation_number: 'VAR-003', title: 'Upgrade pool hall exhaust fan capacity', description: 'Mechanical schedule revised by consultant after humidity modelling update.', instruction_source: 'Revised drawing', instructed_by: 'RPV Superintendent', estimated_value: 7315000, status: 'approved', captured_at: iso(-31), response_due_date: date(-14), requestor_name: 'Mia Parker', requestor_email: users[0].email, client_email: projects[2].client_email, claim_type: 'lump_sum', basis_of_valuation: 'agreement', client_approval_response: 'approved', client_approval_comment: 'Approved as per revised mechanical schedule.', client_approved_at: iso(-9), client_approved_by_email: projects[2].client_email },
  { project_id: projects[3].id, sequence_number: 4, variation_number: 'VAR-004', title: 'Fire service valve station relocation', description: 'Builder disputed entitlement, claiming relocation was included in original coordination allowance.', instruction_source: 'Verbal direction confirmed by email', instructed_by: 'Westside site manager', estimated_value: 2944000, status: 'disputed', captured_at: iso(-20), response_due_date: date(-6), requestor_name: 'Tom Keane', requestor_email: users[1].email, client_email: projects[3].client_email, claim_type: 'schedule_of_rates', basis_of_valuation: 'contract_rates', client_approval_response: 'rejected', client_approval_comment: 'Please provide drawing revision history and labour breakdown.', client_approved_at: iso(-4), client_approved_by_email: projects[3].client_email },
  { project_id: projects[0].id, sequence_number: 5, variation_number: 'VAR-005', title: 'Temporary bypass ductwork for staging sequence', description: 'Site staging changed after ward access restrictions. Temporary ductwork required to maintain ventilation.', instruction_source: 'Client meeting minutes', instructed_by: 'BuildCore site meeting minute 42', estimated_value: 1599000, status: 'submitted', captured_at: iso(-16), response_due_date: date(-2), requestor_name: 'Tom Keane', requestor_email: users[1].email, client_email: projects[0].client_email, claim_type: 'cost_and_time', eot_days_claimed: 1, basis_of_valuation: 'daywork', approval_token: crypto.randomUUID(), approval_token_expires_at: iso(14) },
];

function must(result, label) {
  if (result.error) {
    console.error(`${label} failed:`, result.error);
    process.exit(1);
  }
  return result.data;
}

console.log('Seeding Variation Shield staging demo data...');

const { data: existingUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
for (const u of existingUsers?.users || []) {
  if (u.email?.endsWith('@staging.variationshield.com.au')) {
    await supabase.auth.admin.deleteUser(u.id);
  }
}

await supabase.from('companies').delete().eq('id', companyId);

must(await supabase.from('companies').upsert({
  id: companyId,
  name: 'Demo Mechanical Services Pty Ltd',
  abn: '12 345 678 901',
  address: 'Geelong VIC',
  phone: '03 5222 0100',
  plan: 'pro',
  variation_limit: null,
  project_limit: null,
  variation_count: variations.length,
  upgraded_at: now.toISOString(),
}), 'company upsert');

const createdUsers = [];
for (const u of users) {
  const created = must(await supabase.auth.admin.createUser({
    email: u.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: u.name },
  }), `create user ${u.email}`).user;
  createdUsers.push({ ...u, id: created.id });
}

must(await supabase.from('company_members').insert(createdUsers.map((u) => ({
  company_id: companyId,
  user_id: u.id,
  role: u.role,
  is_active: true,
  accepted_at: now.toISOString(),
}))), 'company members insert');

const managerId = createdUsers[0].id;
must(await supabase.from('projects').upsert(projects.map((p) => ({
  ...p,
  company_id: companyId,
  created_by: managerId,
  is_active: true,
  notice_required: true,
}))), 'projects upsert');

must(await supabase.from('variations').upsert(variations.map((v) => ({
  id: crypto.randomUUID(),
  ...v,
  notes: v.status === 'submitted' && new Date(v.response_due_date) < now ? 'Overdue client response — follow up required.' : null,
}))), 'variations upsert');

console.log('Done. Demo users:');
for (const u of createdUsers) console.log(`- ${u.email} / ${password} (${u.role})`);
console.log('Use only with the staging Supabase project.');
