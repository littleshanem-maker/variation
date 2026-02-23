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
}

const RoleContext = createContext<RoleContextType>({
  role: 'admin',
  isAdmin: true,
  isOffice: false,
  isField: false,
  company: null,
  companyId: null,
  memberships: [],
  isLoading: true,
  userId: null,
  switchCompany: () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<CompanyMembership[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMembership();
  }, []);

  async function fetchMembership() {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsLoading(false);
      return;
    }

    setUserId(session.user.id);

    const { data, error } = await supabase
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
      .eq('user_id', session.user.id)
      .eq('is_active', true);

    if (!error && data) {
      const mapped: CompanyMembership[] = data.map((m: any) => ({
        id: m.id,
        company_id: m.company_id,
        user_id: m.user_id,
        role: m.role as UserRole,
        is_active: m.is_active,
        invited_at: m.invited_at,
        accepted_at: m.accepted_at,
        company: m.companies || undefined,
      }));
      setMemberships(mapped);
      if (mapped.length > 0) {
        setActiveCompanyId(mapped[0].company_id);
      }
    }
    setIsLoading(false);
  }

  const activeMembership = useMemo(
    () => memberships.find(m => m.company_id === activeCompanyId) || null,
    [memberships, activeCompanyId]
  );

  const role: UserRole = activeMembership?.role ?? 'admin';
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
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
