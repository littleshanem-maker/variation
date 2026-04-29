'use client';

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { createClient } from './supabase';
import type { UserRole, Company, CompanyMembership } from './types';

interface RoleContextType {
  role: UserRole;
  isAdmin: boolean;
  isOffice: boolean;
  isField: boolean;
  company: Company | null;
  companyId: string | null;
  memberships: CompanyMembership[];
  isLoading: boolean;
  userId: string | null;
  switchCompany: (companyId: string) => void;
  refreshCompany: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType>({
  role: 'office',
  isAdmin: false,
  isOffice: true,
  isField: false,
  company: null,
  companyId: null,
  memberships: [],
  isLoading: true,
  userId: null,
  switchCompany: () => {},
  refreshCompany: async () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<CompanyMembership[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMembership();

    // Re-fetch when auth state changes (login/logout)
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchMembership();
      } else if (event === 'SIGNED_OUT') {
        setMemberships([]);
        setActiveCompanyId(null);
        setUserId(null);
        setIsLoading(false);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  async function fetchMembership() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMemberships([]);
      setActiveCompanyId(null);
      setUserId(null);
      setIsLoading(false);
      return;
    }

    setUserId(session.user.id);

    try {
      // Server-side bootstrap uses the service role and avoids company_members RLS recursion.
      const res = await fetch('/api/me/bootstrap', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Bootstrap failed (${res.status})`);
      const data = await res.json();
      const nextMemberships = (data.memberships || []) as CompanyMembership[];

      setMemberships(nextMemberships);
      setActiveCompanyId(data.activeCompanyId ?? nextMemberships[0]?.company_id ?? null);
    } catch (error) {
      console.error('Failed to fetch membership bootstrap:', error);
      setMemberships([]);
      setActiveCompanyId(null);
    } finally {
      setIsLoading(false);
    }
  }

  const activeMembership = useMemo(
    () => memberships.find(m => m.company_id === activeCompanyId) || null,
    [memberships, activeCompanyId]
  );

  // Unknown/no membership should not be treated as field. Field is a restricted
  // capture-only role; default unknown users to office/dashboard behaviour.
  const role: UserRole = activeMembership?.role ?? 'office';
  const company: Company | null = activeMembership?.company ?? null;

  return (
    <RoleContext.Provider value={{
      role,
      isAdmin: role === 'admin',
      isOffice: role === 'office',
      isField: role === 'field',
      company,
      companyId: activeCompanyId,
      memberships,
      isLoading,
      userId,
      switchCompany: setActiveCompanyId,
      refreshCompany: fetchMembership,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
