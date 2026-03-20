#!/usr/bin/env node
/**
 * provision-alfred.js — Create Alfred Quadrio's real Vecta Group account
 */

const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL  = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjE5NTEsImV4cCI6MjA4NzI5Nzk1MX0.f8DTWLnuITDS_SA42meoLwTCldqX34C7khm_zgjpP5o';

const EMAIL    = 'alfred.quadrio@vectagroup.com.au';
const PASSWORD = 'VectaLive2026!';
const COMPANY  = 'Vecta Group';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function main() {
  console.log('📝 Creating account for Alfred Quadrio...');

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
    options: {
      data: { full_name: 'Alfred Quadrio', display_name: 'Alfred Quadrio', company_name: COMPANY },
    },
  });

  if (signUpError) {
    console.error('❌ Signup failed:', signUpError.message);
    process.exit(1);
  }

  console.log('✅ Auth user created:', signUpData.user?.id);

  // Provision company via RPC
  const companyId = randomUUID();
  const { error: provErr } = await supabase.rpc('provision_new_account', {
    p_company_id: companyId,
    p_company_name: COMPANY,
  });

  if (provErr) {
    console.error('❌ Provision failed:', provErr.message);
    process.exit(1);
  }

  console.log('✅ Company provisioned:', COMPANY);
  console.log('');
  console.log('─────────────────────────────────');
  console.log('  Login details for Alfred:');
  console.log('  Email:    ', EMAIL);
  console.log('  Password: ', PASSWORD);
  console.log('  URL:      https://variationshield.com.au/login');
  console.log('─────────────────────────────────');
}

main();
