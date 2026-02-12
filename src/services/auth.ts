/**
 * Auth Service — Phase 2
 *
 * Supabase authentication with email/password.
 * Falls back gracefully to offline-only mode when not configured.
 */

import { config } from '../config';
import { UserProfile, AuthState } from '../types/domain';

let supabase: any = null;

async function getSupabase() {
  if (!config.supabase.enabled) return null;
  if (supabase) return supabase;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

    supabase = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    return supabase;
  } catch (error) {
    console.error('[Auth] Failed to initialise Supabase:', error);
    return null;
  }
}

export async function signUp(email: string, password: string, fullName?: string): Promise<{ user: UserProfile | null; error: string | null }> {
  const client = await getSupabase();
  if (!client) return { user: null, error: 'Cloud services not configured' };

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) return { user: null, error: error.message };
  if (!data.user) return { user: null, error: 'Sign up failed' };

  return {
    user: {
      id: data.user.id,
      email: data.user.email!,
      fullName: fullName,
      createdAt: data.user.created_at,
    },
    error: null,
  };
}

export async function signIn(email: string, password: string): Promise<{ user: UserProfile | null; error: string | null }> {
  const client = await getSupabase();
  if (!client) return { user: null, error: 'Cloud services not configured' };

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) return { user: null, error: error.message };
  if (!data.user) return { user: null, error: 'Sign in failed' };

  return {
    user: {
      id: data.user.id,
      email: data.user.email!,
      fullName: data.user.user_metadata?.full_name,
      createdAt: data.user.created_at,
    },
    error: null,
  };
}

export async function signOut(): Promise<void> {
  const client = await getSupabase();
  if (client) await client.auth.signOut();
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const client = await getSupabase();
  if (!client) return null;

  const { data } = await client.auth.getUser();
  if (!data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email!,
    fullName: data.user.user_metadata?.full_name,
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
