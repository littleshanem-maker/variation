/**
 * Auth Service — Phase 2
 *
 * Supabase authentication with email/password.
 * Falls back gracefully to offline-only mode when not configured.
 */

import { UserProfile, AuthState, CompanyMembership, UserRole } from '../types/domain';
import { getSupabase } from './supabase';
import { config } from '../config';

async function fetchMemberships(userId: string): Promise<CompanyMembership[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('company_members')
    .select(`
      id,
      company_id,
      user_id,
      role,
      is_active,
      invited_at,
      accepted_at,
      companies:company_id (
        id, name, abn, address, phone, logo_url, created_at, updated_at
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !data) return [];

  return data.map((m: any) => ({
    id: m.id,
    companyId: m.company_id,
    userId: m.user_id,
    role: m.role as UserRole,
    isActive: m.is_active,
    invitedAt: m.invited_at,
    acceptedAt: m.accepted_at,
    company: m.companies ? {
      id: m.companies.id,
      name: m.companies.name,
      abn: m.companies.abn,
      address: m.companies.address,
      phone: m.companies.phone,
      logoUrl: m.companies.logo_url,
      createdAt: m.companies.created_at,
      updatedAt: m.companies.updated_at,
    } : undefined,
  }));
}

export async function signUp(email: string, password: string, fullName?: string): Promise<{ user: UserProfile | null; error: string | null }> {
  const client = getSupabase();
  if (!client) return { user: null, error: 'Cloud services not configured' };

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) return { user: null, error: error.message };
  if (!data.user) return { user: null, error: 'Sign up failed' };

  const memberships = await fetchMemberships(data.user.id);

  return {
    user: {
      id: data.user.id,
      email: data.user.email!,
      fullName: fullName,
      memberships,
      activeCompanyId: memberships[0]?.companyId,
      activeRole: memberships[0]?.role,
      createdAt: data.user.created_at,
    },
    error: null,
  };
}

export async function signIn(email: string, password: string): Promise<{ user: UserProfile | null; error: string | null }> {
  const client = getSupabase();
  if (!client) return { user: null, error: 'Cloud services not configured' };

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) return { user: null, error: error.message };
  if (!data.user) return { user: null, error: 'Sign in failed' };

  const memberships = await fetchMemberships(data.user.id);

  return {
    user: {
      id: data.user.id,
      email: data.user.email!,
      fullName: data.user.user_metadata?.full_name,
      memberships,
      activeCompanyId: memberships[0]?.companyId,
      activeRole: memberships[0]?.role,
      createdAt: data.user.created_at,
    },
    error: null,
  };
}

export async function signOut(): Promise<void> {
  const client = getSupabase();
  if (client) await client.auth.signOut();
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data } = await client.auth.getUser();
  if (!data.user) return null;

  const memberships = await fetchMemberships(data.user.id);

  return {
    id: data.user.id,
    email: data.user.email!,
    fullName: data.user.user_metadata?.full_name,
    memberships,
    activeCompanyId: memberships[0]?.companyId,
    activeRole: memberships[0]?.role,
    createdAt: data.user.created_at,
  };
}

export async function getAuthState(): Promise<AuthState> {
  const user = await getCurrentUser();
  return {
    user,
    isLoading: false,
    isAuthenticated: user !== null,
  };
}

export function isCloudEnabled(): boolean {
  return config.supabase.enabled;
}
