#!/usr/bin/env node
/**
 * create-gemfire-field-v2.js
 * Uses the invitation flow to create a GEM Fire field account:
 * 1. PM creates an invitation (inserts into invitations table)
 * 2. Field user logs in and calls accept_invitation RPC (bypasses RLS)
 */

const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL = 'https://ketidyzumcdxditjfruk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldGlkeXp1bWNkeGRpdGpmcnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MjE5NTEsImV4cCI6MjA4NzI5Nzk1MX0.f8DTWLnuITDS_SA42meoLwTCldqX34C7khm_zgjpP5o';

const FIELD_EMAIL    = 'supervisor-gemfire@leveragedsystems.com.au';
const FIELD_PASSWORD = 'GemFireSuper2026!';
const FIELD_NAME     = 'Jake Morrison';
const FIELD_USER_ID  = '8935aeb7-0ecd-4b1d-a5ee-01b58a2234a9';

const PM_EMAIL       = 'demo-gemfire@leveragedsystems.com.au';
const PM_PASSWORD    = 'GemFireDemo2026!';
const COMPANY_ID     = '8107b934-2f91-4f8e-8e83-45be6c8ddfdd';

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ── Step 1: PM creates the invitation ────────────────────────────────────────
  console.log('🔐 Step 1: PM creates invitation...');
  const { error: pmErr } = await supabase.auth.signInWithPassword({ email: PM_EMAIL, password: PM_PASSWORD });
  if (pmErr) { console.error('❌ PM auth failed:', pmErr.message); process.exit(1); }

  const { data: pmData } = await supabase.auth.getUser();
  const pmUserId = pmData.user.id;
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Check for existing unused invite for this email
  const { data: existingInvite } = await supabase
    .from('invitations')
    .select('id, token')
    .eq('company_id', COMPANY_ID)
    .eq('email', FIELD_EMAIL)
    .is('accepted_at', null)
    .maybeSingle();

  let inviteToken = token;
  if (existingInvite) {
    console.log('ℹ️  Existing invitation found — reusing token');
    inviteToken = existingInvite.token;
  } else {
    const { error: invErr } = await supabase.from('invitations').insert({
      company_id: COMPANY_ID,
      email: FIELD_EMAIL,
      role: 'field',
      invited_by: pmUserId,
      token,
      expires_at: expiresAt,
    });
    if (invErr) { console.error('❌ Failed to create invitation:', invErr.message); process.exit(1); }
    console.log('✅ Invitation created');
  }

  await supabase.auth.signOut();

  // ── Step 2: Field user signs in and accepts ───────────────────────────────────
  console.log('\n🔐 Step 2: Field user accepts invitation via RPC...');
  const { error: fieldErr } = await supabase.auth.signInWithPassword({ email: FIELD_EMAIL, password: FIELD_PASSWORD });
  if (fieldErr) { console.error('❌ Field auth failed:', fieldErr.message); process.exit(1); }
  console.log('✅ Field user signed in');

  // Check if already a member (accept_invitation would fail/be no-op)
  const { data: existingMember } = await supabase
    .from('company_members')
    .select('id, role')
    .eq('user_id', FIELD_USER_ID)
    .eq('company_id', COMPANY_ID)
    .maybeSingle();

  if (existingMember) {
    console.log(`ℹ️  Already a company member (role: ${existingMember.role})`);
    if (existingMember.role !== 'field') {
      // Try updating role — field user updating their own membership
      const { error: roleErr } = await supabase
        .from('company_members')
        .update({ role: 'field' })
        .eq('user_id', FIELD_USER_ID)
        .eq('company_id', COMPANY_ID);
      if (roleErr) console.warn('⚠️  Could not update role:', roleErr.message);
      else console.log('✅ Role updated to field');
    } else {
      console.log('✅ Already field role — all good!');
    }
  } else {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('accept_invitation', {
      invite_token: inviteToken,
    });

    if (rpcErr) {
      console.error('❌ RPC accept_invitation failed:', rpcErr.message);
      console.log('\n📋 Manual fallback — run this SQL in Supabase dashboard:');
      console.log(`INSERT INTO company_members (user_id, company_id, role)`);
      console.log(`VALUES ('${FIELD_USER_ID}', '${COMPANY_ID}', 'field')`);
      console.log(`ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'field';`);
    } else {
      if (rpcResult?.error) {
        console.error('❌ accept_invitation returned error:', rpcResult.error);
      } else {
        console.log('✅ Invitation accepted! Field user is now a company member.');
        console.log('   Result:', JSON.stringify(rpcResult));
      }
    }
  }

  // ── Step 3: Update display name ───────────────────────────────────────────────
  console.log('\n📝 Updating display name...');
  const { error: nameErr } = await supabase.auth.updateUser({
    data: { display_name: FIELD_NAME, full_name: FIELD_NAME }
  });
  if (nameErr) console.warn('⚠️  Display name update failed:', nameErr.message);
  else console.log(`✅ Display name set to: ${FIELD_NAME}`);

  await supabase.auth.signOut();

  console.log('\n🎉 GEM Fire Field Account Ready:');
  console.log(`   Email:    ${FIELD_EMAIL}`);
  console.log(`   Password: ${FIELD_PASSWORD}`);
  console.log(`   Name:     ${FIELD_NAME}`);
  console.log(`   Role:     field`);
  console.log(`   URL:      https://variationshield.com.au/field`);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
