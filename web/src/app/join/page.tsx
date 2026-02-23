'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';

interface InviteInfo {
  id: string;
  email: string;
  role: string;
  company_name: string;
  company_id: string;
  expires_at: string;
}

function JoinForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signup form
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // For existing users who are already logged in
  const [existingUser, setExistingUser] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided.');
      setLoading(false);
      return;
    }
    loadInvite();
  }, [token]);

  async function loadInvite() {
    const supabase = createClient();

    // Check if user is already logged in
    const { data: { session } } = await supabase.auth.getSession();

    // Fetch invitation by token — use RPC or direct query
    // Since invitees can view their own invitations, we need a public lookup
    // Use a simple approach: query with service role isn't available client-side,
    // so we'll query invitations and join companies
    const { data, error: fetchErr } = await supabase
      .from('invitations')
      .select('id, email, role, expires_at, company_id, companies:company_id (name)')
      .eq('token', token)
      .is('accepted_at', null)
      .single();

    if (fetchErr || !data) {
      setError('This invitation is invalid or has already been used.');
      setLoading(false);
      return;
    }

    // Check expiry
    if (new Date(data.expires_at) < new Date()) {
      setError('This invitation has expired. Please ask your admin for a new one.');
      setLoading(false);
      return;
    }

    const companyName = (data.companies as any)?.name || 'Unknown Company';

    setInvite({
      id: data.id,
      email: data.email,
      role: data.role,
      company_name: companyName,
      company_id: data.company_id,
      expires_at: data.expires_at,
    });

    // If logged in as the invited user, show "Join" button instead of signup
    if (session?.user?.email?.toLowerCase() === data.email.toLowerCase()) {
      setExistingUser(true);
    }

    setLoading(false);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!invite || !password) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    // Sign up with the invited email
    const { data: signupData, error: signupErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: fullName.trim() || undefined } },
    });

    if (signupErr) {
      // If user already exists, try sign in
      if (signupErr.message.includes('already registered')) {
        setError('An account with this email already exists. Please log in first, then use this invite link again.');
        setSubmitting(false);
        return;
      }
      setError(signupErr.message);
      setSubmitting(false);
      return;
    }

    if (!signupData.user) {
      setError('Signup failed. Please try again.');
      setSubmitting(false);
      return;
    }

    // Add user to company
    const { error: memberErr } = await supabase.from('company_members').insert({
      company_id: invite.company_id,
      user_id: signupData.user.id,
      role: invite.role,
      accepted_at: new Date().toISOString(),
    });

    if (memberErr) {
      console.error('Failed to join company:', memberErr);
      // Don't block — user is created, they can be added manually
    }

    // Mark invitation as accepted
    await supabase.from('invitations').update({
      accepted_at: new Date().toISOString(),
    }).eq('id', invite.id);

    // Redirect to dashboard
    router.push('/');
    router.refresh();
  }

  async function handleJoinExisting() {
    if (!invite) return;
    setJoining(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Please log in first.');
      setJoining(false);
      return;
    }

    // Add to company
    const { error: memberErr } = await supabase.from('company_members').insert({
      company_id: invite.company_id,
      user_id: user.id,
      role: invite.role,
      accepted_at: new Date().toISOString(),
    });

    if (memberErr) {
      setError('Failed to join: ' + memberErr.message);
      setJoining(false);
      return;
    }

    // Mark invitation accepted
    await supabase.from('invitations').update({
      accepted_at: new Date().toISOString(),
    }).eq('id', invite.id);

    router.push('/');
    router.refresh();
  }

  const roleLabelMap: Record<string, string> = {
    admin: 'Administrator',
    office: 'Office',
    field: 'Field',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-[#9CA3AF] text-sm">Loading invitation...</p>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1B365D' }}>
          <span className="text-white text-sm font-bold tracking-tight">VC</span>
        </div>
        <h1 className="text-xl font-semibold text-[#1C1C1E] mb-2">Invalid Invitation</h1>
        <p className="text-[#6B7280] text-sm text-center max-w-sm">{error}</p>
        <a href="/login" className="mt-6 text-sm font-medium text-[#1B365D] hover:text-[#24466F]">Go to Login →</a>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-white">
      {/* Top gradient */}
      <div className="absolute top-0 left-0 right-0 h-64" style={{ background: 'linear-gradient(180deg, #E2E8F0 0%, #EEF2F7 40%, rgba(255,255,255,0) 100%)' }} />
      <div className="absolute top-0 left-0 right-0 h-40 opacity-30" style={{ background: 'linear-gradient(135deg, #CBD5E1 0%, #DDD6CC 50%, #C7D2E0 100%)' }} />

      <div className="relative z-10 w-full max-w-sm mx-auto px-6">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1B365D' }}>
            <span className="text-white text-sm font-bold tracking-tight">VC</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1C1C1E]">
            Join {invite.company_name}
          </h1>
          <p className="text-sm mt-1.5 text-[#6B7280]">
            You&apos;ve been invited as <span className="font-medium text-[#1C1C1E]">{roleLabelMap[invite.role] || invite.role}</span>
          </p>
        </div>

        {/* Invite details card */}
        <div className="bg-[#F8F8F6] rounded-lg border border-[#E5E7EB] p-4 mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#6B7280]">Company</span>
            <span className="font-medium text-[#1C1C1E]">{invite.company_name}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-[#6B7280]">Role</span>
            <span className="font-medium text-[#1C1C1E] capitalize">{invite.role}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-[#6B7280]">Email</span>
            <span className="font-medium text-[#1C1C1E]">{invite.email}</span>
          </div>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#FDF2F0', border: '1px solid rgba(178,91,78,0.15)', color: '#B25B4E' }}>
            {error}
          </div>
        )}

        {existingUser ? (
          /* Already logged in as the invited user */
          <button
            onClick={handleJoinExisting}
            disabled={joining}
            className="w-full rounded-lg text-base font-semibold transition-all"
            style={{
              padding: '12px',
              backgroundColor: '#1B365D',
              color: '#FFFFFF',
              opacity: joining ? 0.5 : 1,
              cursor: joining ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            {joining ? 'Joining...' : `Join ${invite.company_name}`}
          </button>
        ) : (
          /* New user signup */
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full rounded-lg text-base outline-none transition-all"
                style={{ padding: '12px 16px', backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', color: '#1C1C1E' }}
                onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 3px rgba(27,54,93,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                placeholder="Full name"
              />
            </div>
            <div>
              <input
                type="email"
                value={invite.email}
                disabled
                className="w-full rounded-lg text-base outline-none"
                style={{ padding: '12px 16px', backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280' }}
              />
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg text-base outline-none transition-all"
                style={{ padding: '12px 44px 12px 16px', backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', color: '#1C1C1E' }}
                onFocus={e => { e.target.style.borderColor = '#1B365D'; e.target.style.boxShadow = '0 0 0 3px rgba(27,54,93,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
                placeholder="Create a password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ right: '12px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}
                tabIndex={-1}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full rounded-lg text-base font-semibold transition-all"
              style={{
                padding: '12px',
                backgroundColor: '#1B365D',
                color: '#FFFFFF',
                opacity: (submitting || !password) ? 0.5 : 1,
                cursor: (submitting || !password) ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              {submitting ? 'Creating account...' : 'Create Account & Join'}
            </button>
          </form>
        )}

        <div className="text-center mt-5">
          <a href="/login" className="text-sm font-medium text-[#1B365D] hover:text-[#24466F] transition-colors">
            Already have an account? Log in
          </a>
        </div>

        <p className="text-center text-xs mt-10 text-[#C4C9D0]">
          Leveraged Systems · Pipeline Consulting Pty Ltd
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-[#9CA3AF] text-sm">Loading...</p>
      </div>
    }>
      <JoinForm />
    </Suspense>
  );
}
