#!/usr/bin/env node
/**
 * monitor-kai.js — Check Kai Richards' GEM Fire account activity
 * Reports: last login, projects created, variations logged, team members added
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL  = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjE5NTEsImV4cCI6MjA4NzI5Nzk1MX0.f8DTWLnuITDS_SA42meoLwTCldqX34C7khm_zgjpP5o';

const KAI_EMAIL    = 'krichards@gemfire.com.au';
const KAI_PASSWORD = 'GemFire2026!';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: KAI_EMAIL,
    password: KAI_PASSWORD,
  });
  if (authError) { console.error('❌ Auth failed:', authError.message); process.exit(1); }

  const userId = authData.user.id;
  const lastSignIn = authData.user.last_sign_in_at;

  // Get company
  const { data: members } = await supabase.from('company_members').select('company_id').eq('user_id', userId);
  if (!members?.length) { console.error('❌ No company found'); process.exit(1); }
  const companyId = members[0].company_id;

  // Get all company members (team)
  const { data: team } = await supabase.from('company_members').select('user_id, role, invited_at, accepted_at').eq('company_id', companyId);

  // Get projects
  const { data: projects } = await supabase.from('projects').select('id, name, created_at').eq('company_id', companyId).order('created_at', { ascending: false });

  // Get variations
  const projectIds = projects?.map(p => p.id) || [];
  let variations = [];
  if (projectIds.length > 0) {
    const { data: vars } = await supabase.from('variations').select('id, title, status, created_at, project_id').in('project_id', projectIds).order('created_at', { ascending: false });
    variations = vars || [];
  }

  // Get notices
  let notices = [];
  if (projectIds.length > 0) {
    const { data: nots } = await supabase.from('variation_notices').select('id, description, created_at, project_id').in('project_id', projectIds).order('created_at', { ascending: false });
    notices = nots || [];
  }

  // Format report
  const now = new Date();
  const lastLogin = lastSignIn ? new Date(lastSignIn) : null;
  const minutesSinceLogin = lastLogin ? Math.floor((now - lastLogin) / 60000) : null;

  const report = {
    lastLogin: lastSignIn ? `${lastLogin.toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })} (${minutesSinceLogin < 60 ? minutesSinceLogin + 'min ago' : Math.floor(minutesSinceLogin/60) + 'h ago'})` : 'Never',
    hasLoggedIn: !!lastSignIn,
    teamMembers: team?.length || 0,
    projects: projects?.length || 0,
    projectNames: projects?.map(p => p.name) || [],
    variations: variations.length,
    notices: notices.length,
    recentVariation: variations[0] ? `"${variations[0].title}" (${variations[0].status}) — ${new Date(variations[0].created_at).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })}` : null,
    recentNotice: notices[0] ? `"${notices[0].description?.slice(0, 60)}..." — ${new Date(notices[0].created_at).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })}` : null,
  };

  console.log('\n📊 KAI RICHARDS — GEM FIRE ACTIVITY REPORT');
  console.log('─────────────────────────────────────────');
  console.log(`🕐 Last login:    ${report.lastLogin}`);
  console.log(`👥 Team members:  ${report.teamMembers}`);
  console.log(`📁 Projects:      ${report.projects}${report.projectNames.length ? ' — ' + report.projectNames.join(', ') : ''}`);
  console.log(`📝 Variations:    ${report.variations}`);
  console.log(`📋 Notices:       ${report.notices}`);
  if (report.recentVariation) console.log(`   Latest var:  ${report.recentVariation}`);
  if (report.recentNotice)    console.log(`   Latest notice: ${report.recentNotice}`);
  console.log('─────────────────────────────────────────\n');

  // Exit code signals to cron: 0 = activity found, 2 = no activity yet
  const hasActivity = report.projects > 0 || report.variations > 0 || report.teamMembers > 1;
  process.exit(hasActivity ? 0 : 2);
}

run();
