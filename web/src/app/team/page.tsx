'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import TopBar from '@/components/TopBar';
import { createClient } from '@/lib/supabase';
import { useRole } from '@/lib/role';
import type { UserRole } from '@/lib/types';

interface TeamMember {
  id: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  invited_at: string;
  accepted_at: string | null;
  email: string;
  full_name: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  expires_at: string;
  created_at: string;
}

export default function TeamPage() {
  const router = useRouter();
  const { isAdmin, companyId, company, isLoading: roleLoading } = useRole();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('field');
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (roleLoading) return;
    if (!isAdmin) {
      router.push('/');
      return;
    }
    if (companyId) {
      loadTeam();
    }
  }, [roleLoading, isAdmin, companyId]);

  async function loadTeam() {
    if (!companyId) return;
    const supabase = createClient();

    // Fetch members
    const { data: memberData, error: memberErr } = await supabase
      .from('company_members')
      .select('id, company_id, user_id, role, is_active, invited_at, accepted_at')
      .eq('company_id', companyId)
      .order('invited_at');

    if (memberData && memberData.length > 0) {
      // Fetch emails via RPC
      const userIds = memberData.map(m => m.user_id);
      const { data: emailData } = await supabase.rpc('get_user_emails', { user_ids: userIds });
      const emailMap: Record<string, { email: string; full_name: string | null }> = {};
      for (const e of (emailData || []) as any[]) {
        emailMap[e.user_id] = { email: e.email, full_name: e.full_name };
      }

      const enriched: TeamMember[] = memberData.map(m => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role as UserRole,
        is_active: m.is_active,
        invited_at: m.invited_at,
        accepted_at: m.accepted_at,
        email: emailMap[m.user_id]?.email || m.user_id.slice(0, 8) + '...',
        full_name: emailMap[m.user_id]?.full_name || null,
      }));
      setMembers(enriched);
    }

    // Fetch pending invitations
    const { data: inviteData } = await supabase
      .from('invitations')
      .select('id, email, role, token, expires_at, created_at')
      .eq('company_id', companyId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });

    setInvites(inviteData || []);
    setLoading(false);
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    if (!companyId) { alert('Company not loaded yet. Please refresh and try again.'); return; }
    setSending(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    const token = crypto.randomUUID();
    const { error } = await supabase.from('invitations').insert({
      company_id: companyId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: user.id,
      token,
    });

    if (error) {
      console.error('Invite failed:', error);
      alert('Failed to send invitation: ' + error.message);
    } else {
      const link = `${window.location.origin}/join?token=${token}`;
      setInviteLink(link);
      setInviteEmail('');
      loadTeam();
    }
    setSending(false);
  }

  async function handleRemoveMember(memberId: string) {
    const supabase = createClient();
    const { error } = await supabase.from('company_members').update({ is_active: false }).eq('id', memberId);
    if (error) {
      console.error('Remove member failed:', error);
      alert('Failed to remove member: ' + error.message);
    }
    loadTeam();
  }

  async function handleChangeRole(memberId: string, newRole: UserRole) {
    const supabase = createClient();
    const { error } = await supabase.from('company_members').update({ role: newRole }).eq('id', memberId);
    if (error) {
      console.error('Change role failed:', error);
      alert('Failed to change role: ' + error.message);
    }
    loadTeam();
  }

  async function handleRevokeInvite(inviteId: string) {
    const supabase = createClient();
    await supabase.from('invitations').delete().eq('id', inviteId);
    loadTeam();
  }

  const roleBadgeColors: Record<string, string> = {
    admin: 'bg-[#1B365D]/10 text-[#1B365D]',
    office: 'bg-[#D4A853]/10 text-[#96752A]',
    field: 'bg-[#E8713A]/10 text-[#B85A2B]',
  };

  if (!isAdmin) return null;

  return (
    <AppShell>
      <TopBar title="Team Management" />
      <div className="p-8 max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#1C1C1E]">Team</h2>
            <p className="text-[13px] text-[#6B7280] mt-1">{company?.name} · {members.filter(m => m.is_active).length} active members</p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] transition-colors duration-[120ms] shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            + Invite Member
          </button>
        </div>

        {/* Active Members */}
        <div className="bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E5E7EB]">
            <h3 className="text-[13px] font-semibold text-[#1C1C1E]">Active Members</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-[#9CA3AF] text-sm">Loading...</div>
          ) : members.filter(m => m.is_active).length === 0 ? (
            <div className="p-8 text-center text-[#9CA3AF] text-sm">No team members yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-2">User</th>
                  <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-2">Role</th>
                  <th className="text-left text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-2">Joined</th>
                  <th className="text-right text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] px-5 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.filter(m => m.is_active).map((m, i) => (
                  <tr key={m.id} className={`h-[44px] border-b border-[#F0F0EE] ${i === members.filter(x => x.is_active).length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-5 py-2.5">
                      <div className="text-[14px] text-[#1C1C1E]">{m.email}</div>
                      {m.full_name && <div className="text-[12px] text-[#9CA3AF]">{m.full_name}</div>}
                    </td>
                    <td className="px-5 py-2.5">
                      <select
                        value={m.role}
                        onChange={e => handleChangeRole(m.id, e.target.value as UserRole)}
                        className={`text-[12px] font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer ${roleBadgeColors[m.role]}`}
                      >
                        <option value="admin">Admin</option>
                        <option value="office">Office</option>
                        <option value="field">Field</option>
                      </select>
                    </td>
                    <td className="px-5 py-2.5 text-[13px] text-[#6B7280]">
                      {m.accepted_at ? new Date(m.accepted_at).toLocaleDateString() : 'Pending'}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        className="text-[12px] text-[#9CA3AF] hover:text-[#B25B4E] transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pending Invitations */}
        {invites.length > 0 && (
          <div className="bg-white rounded-md border border-[#E5E7EB] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E5E7EB]">
              <h3 className="text-[13px] font-semibold text-[#1C1C1E]">Pending Invitations</h3>
            </div>
            <table className="w-full">
              <tbody>
                {invites.map((inv, i) => {
                  const link = `${window.location.origin}/join?token=${inv.token}`;
                  return (
                    <tr key={inv.id} className={`h-[44px] border-b border-[#F0F0EE] ${i === invites.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-5 py-2.5 text-[14px] text-[#1C1C1E]">{inv.email}</td>
                      <td className="px-5 py-2.5">
                        <span className={`inline-block px-2.5 py-1 text-[12px] font-medium rounded-full capitalize ${roleBadgeColors[inv.role]}`}>
                          {inv.role}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-[13px] text-[#9CA3AF]">
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-2.5 text-right flex items-center justify-end gap-3">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(link);
                            alert('Link copied!');
                          }}
                          className="text-[12px] text-[#1B365D] hover:text-[#24466F] font-medium transition-colors"
                        >
                          Copy Link
                        </button>
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="text-[12px] text-[#9CA3AF] hover:text-[#B25B4E] transition-colors"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Invite Modal */}
        {(showInvite || inviteLink) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => { setShowInvite(false); setInviteLink(null); setCopied(false); }}>
            <div className="bg-white rounded-md border border-[#E5E7EB] shadow-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              {inviteLink ? (
                /* Show invite link after creation */
                <>
                  <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-2">Invitation Created ✓</h3>
                  <p className="text-[13px] text-[#6B7280] mb-4">Share this link with your team member. It expires in 7 days.</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="flex-1 px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md bg-[#F8F8F6] text-[#1C1C1E] font-mono"
                      onClick={e => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-3 py-2 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] transition-colors duration-[120ms] whitespace-nowrap"
                    >
                      {copied ? '✓ Copied' : 'Copy Link'}
                    </button>
                  </div>
                  <div className="flex justify-end mt-5">
                    <button
                      onClick={() => { setInviteLink(null); setCopied(false); setShowInvite(false); }}
                      className="px-4 py-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors duration-[120ms]"
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : (
                /* Invite form */
                <>
                  <h3 className="text-[15px] font-semibold text-[#1C1C1E] mb-4">Invite Team Member</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Email Address</label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none"
                        placeholder="john@example.com"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1">Role</label>
                      <select
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none bg-white"
                      >
                        <option value="field">Field — capture variations only, no pricing</option>
                        <option value="office">Office — full register, reports, pricing</option>
                        <option value="admin">Admin — everything + team management</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-5">
                    <button
                      onClick={() => setShowInvite(false)}
                      className="px-3 py-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1C1C1E] transition-colors duration-[120ms]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleInvite}
                      disabled={sending || !inviteEmail.trim()}
                      className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#1B365D] rounded-md hover:bg-[#24466F] disabled:opacity-40 transition-colors duration-[120ms]"
                    >
                      {sending ? 'Creating...' : 'Create Invitation'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
