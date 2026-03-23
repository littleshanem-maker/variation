#!/usr/bin/env node
/**
 * set-kai-password.js — Sign in as Kai and update his password
 * Run this to set a known password, or pass a new one as arg:
 *   node set-kai-password.js MyNewPassword123!
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL  = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjE5NTEsImV4cCI6MjA4NzI5Nzk1MX0.f8DTWLnuITDS_SA42meoLwTCldqX34C7khm_zgjpP5o';

const EMAIL       = 'krichards@gemfire.com.au';
const OLD_PASS    = 'GemFire2026!';
const NEW_PASS    = process.argv[2] || 'GemFire2026!';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: OLD_PASS });
  if (error) { console.error('❌ Sign in failed:', error.message); process.exit(1); }

  const { error: updateError } = await supabase.auth.updateUser({ password: NEW_PASS });
  if (updateError) { console.error('❌ Password update failed:', updateError.message); process.exit(1); }

  console.log('✅ Password updated for', EMAIL);
  console.log('   New password:', NEW_PASS);
}

run();
