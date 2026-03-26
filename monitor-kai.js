#!/usr/bin/env node
/**
 * monitor-kai.js — Check Kai Richards' GEM Fire account activity
 * Uses service role key — does NOT authenticate as Kai, so last_sign_in_at is not affected
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL         = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTcyMTk1MSwiZXhwIjoyMDg3Mjk3OTUxfQ.qQku9uj7RhKZvkE1JtPx1eWu0FiNmFnyAZmvQCRj_cQ';
const KAI_EMAIL            = 'krichards@gemfire.com.au';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  // Look up Kai's user record without signing in as him
  const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) { console.error('❌ Admin listUsers failed:', userErr.message); process.exit(1); }

  const kai = users.find(u => u.email === KAI_EMAIL);
  if (!kai) { console.error('❌ Kai not found'); process.exit(1); }

  const lastSignIn  = kai.last_sign_in_at ? new Date(kai.last_sign_in_at) : null;
  const now         = new Date();
  const minsAgo     = lastSignIn ? Math.floor((now - lastSignIn) / 60000) : null;
  const loginStr    = lastSignIn
    ? `${lastSignIn.toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })} (${minsAgo < 60 ? minsAgo + 'min ago' : Math.floor(minsAgo / 60) + 'h ago'})`
    : 'Never';

  // Get company via company_members
  const { data: members } = await supabase.from('company_members').select('company_id').eq('user_id', kai.id);
  if (!members?.length) {
    console.log('\n📊 KAI RICHARDS — GEM FIRE');
    console.log('─────────────────────────────────────────');
    console.log('🕐 Last login:   ', loginStr);
    console.log('⚠️  No company found');
    console.log('─────────────────────────────────────────\n');
    return;
  }
  const companyId = members[0].company_id;

  const { data: team }     = await supabase.from('company_members').select('user_id, role').eq('company_id', companyId);
  const { data: projects } = await supabase.from('projects').select('id, name, created_at').eq('company_id', companyId).order('created_at', { ascending: false });
  const projectIds         = projects?.map(p => p.id) || [];

  let vars = [], notices = [];
  if (projectIds.length) {
    const { data: v } = await supabase.from('variations').select('id, title, status, created_at').in('project_id', projectIds).order('created_at', { ascending: false });
    vars = v || [];
    const { data: n } = await supabase.from('variation_notices').select('id, event_description, status, created_at').in('project_id', projectIds).order('created_at', { ascending: false });
    notices = n || [];
  }

  console.log('\n📊 KAI RICHARDS — GEM FIRE ACTIVITY REPORT');
  console.log('─────────────────────────────────────────');
  console.log('🕐 Last login:   ', loginStr);
  console.log('👥 Team members: ', team?.length || 0);
  console.log('📁 Projects:     ', projects?.length || 0, projects?.length ? '— ' + projects.map(p => p.name).join(', ') : '');
  console.log('📝 Variations:   ', vars.length);
  if (vars[0]) console.log('   Latest:       ', `"${vars[0].title}" (${vars[0].status})`);
  console.log('📋 Notices:      ', notices.length);
  if (notices[0]) console.log('   Latest:       ', `"${(notices[0].event_description || '').slice(0, 50)}..."`);
  console.log('─────────────────────────────────────────\n');

  const hasActivity = (projects?.length || 0) > 0 || vars.length > 0 || (team?.length || 0) > 1;
  process.exit(hasActivity ? 0 : 2);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
