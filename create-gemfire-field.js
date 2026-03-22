#!/usr/bin/env node
/**
 * create-gemfire-field.js
 * Creates field account membership via the PM account (which has insert rights)
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjE5NTEsImV4cCI6MjA4NzI5Nzk1MX0.f8DTWLnuITDS_SA42meoLwTCldqX34C7khm_zgjpP5o';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FIELD_USER_ID = '8935aeb7-0ecd-4b1d-a5ee-01b58a2234a9';
const COMPANY_ID = '8107b934-2f91-4f8e-8e83-45be6c8ddfdd';
const PM_EMAIL = 'demo-gemfire@leveragedsystems.com.au';
const PM_PASSWORD = 'GemFireDemo2026!';

async function run() {
  // Sign in as PM — they should have rights to add team members
  console.log('🔐 Signing in as PM to add field member...');
  const { data: pmAuth, error: pmErr } = await supabase.auth.signInWithPassword({
    email: PM_EMAIL,
    password: PM_PASSWORD,
  });
  if (pmErr) { console.error('❌ PM auth failed:', pmErr.message); process.exit(1); }
  console.log('✅ Signed in as PM');

  // Check if field user already has membership
  const { data: existing } = await supabase
    .from('company_members')
    .select('id, role')
    .eq('user_id', FIELD_USER_ID)
    .eq('company_id', COMPANY_ID)
    .maybeSingle();

  if (existing) {
    if (existing.role !== 'field') {
      const { error: updateErr } = await supabase
        .from('company_members')
        .update({ role: 'field' })
        .eq('user_id', FIELD_USER_ID)
        .eq('company_id', COMPANY_ID);
      if (updateErr) console.error('❌ Update role failed:', updateErr.message);
      else console.log('✅ Role updated to field');
    } else {
      console.log('✅ Already a field member — nothing to do');
    }
    await supabase.auth.signOut();
    printSummary();
    return;
  }

  // Insert as PM
  console.log('🏢 Inserting field member via PM session...');
  const { error: insertErr } = await supabase
    .from('company_members')
    .insert({
      user_id: FIELD_USER_ID,
      company_id: COMPANY_ID,
      role: 'field',
    });

  if (insertErr) {
    console.error('❌ Insert failed:', insertErr.message);
    console.log('\n📋 Run this SQL in Supabase dashboard (SQL editor):');
    console.log(`INSERT INTO company_members (user_id, company_id, role)`);
    console.log(`VALUES ('${FIELD_USER_ID}', '${COMPANY_ID}', 'field')`);
    console.log(`ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'field';`);
  } else {
    console.log('✅ Field member added successfully!');
  }

  await supabase.auth.signOut();
  printSummary();
}

function printSummary() {
  console.log('\n🎉 GEM Fire Field Account:');
  console.log('   Email:    supervisor-gemfire@leveragedsystems.com.au');
  console.log('   Password: GemFireSuper2026!');
  console.log('   Name:     Jake Morrison');
  console.log('   Role:     field');
  console.log('   URL:      https://variationshield.com.au/field');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
