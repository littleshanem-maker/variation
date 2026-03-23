#!/usr/bin/env node
/**
 * clear-kai.js — Wipe all data from Kai Richards' GEM Fire account
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL  = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjE5NTEsImV4cCI6MjA4NzI5Nzk1MX0.f8DTWLnuITDS_SA42meoLwTCldqX34C7khm_zgjpP5o';

const EMAIL    = 'krichards@gemfire.com.au';
const PASSWORD = 'GemFire2026!';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  console.log('🔐 Signing in as Kai...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authError) { console.error('❌ Auth failed:', authError.message); process.exit(1); }
  console.log('✅ Signed in:', authData.user.email);

  // Get company_id
  const { data: members } = await supabase.from('company_members').select('company_id').eq('user_id', authData.user.id);
  if (!members?.length) { console.error('❌ No company found'); process.exit(1); }
  const companyId = members[0].company_id;
  console.log('🏢 Company ID:', companyId);

  // Get all projects
  const { data: projects } = await supabase.from('projects').select('id').eq('company_id', companyId);
  const projectIds = projects?.map(p => p.id) || [];
  console.log(`📁 Projects found: ${projectIds.length}`);

  if (projectIds.length > 0) {
    // Clear variation_notices
    const { error: vne, count: vnCount } = await supabase
      .from('variation_notices').delete().in('project_id', projectIds);
    if (vne) console.warn('  ⚠️  variation_notices:', vne.message);
    else console.log('  ✅ variation_notices cleared');

    // Clear status_changes (if exists)
    const { data: varIds } = await supabase.from('variations').select('id').in('project_id', projectIds);
    if (varIds?.length) {
      const variationIds = varIds.map(v => v.id);
      await supabase.from('status_changes').delete().in('variation_id', variationIds);
      await supabase.from('variation_revisions').delete().in('variation_id', variationIds);
      console.log('  ✅ status_changes + revisions cleared');
    }

    // Clear variations
    const { error: ve } = await supabase.from('variations').delete().in('project_id', projectIds);
    if (ve) console.warn('  ⚠️  variations:', ve.message);
    else console.log('  ✅ variations cleared');

    // Clear projects
    const { error: pe } = await supabase.from('projects').delete().eq('company_id', companyId);
    if (pe) console.warn('  ⚠️  projects:', pe.message);
    else console.log('  ✅ projects cleared');
  } else {
    console.log('  ℹ️  No projects to clear');
  }

  console.log('\n✅ GEM Fire account is clean and ready.');
}

run();
