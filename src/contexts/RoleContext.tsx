/**
 * Role Context — RBAC-based replacement for AppModeContext
 *
 * Fetches user's company membership from Supabase and exposes role-based
 * access control throughout the app.
 *
 * Falls back to 'admin' role when offline or Supabase not configured
 * (backwards compat for local development/testing).
 */

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Platform } from 'react-native';
import { fieldColors, officeColors } from '../theme';
import { getSupabase } from '../services/supabase';
import { isCloudEnabled } from '../services/auth';
import { UserRole, Company, CompanyMembership } from '../types/domain';

interface RoleContextType {
  role: UserRole;
  isAdmin: boolean;
  isOffice: boolean;
  isField: boolean;
  company: Company | null;
  companyId: string | null;
  memberships: CompanyMembership[];
  colors: typeof fieldColors;
  switchCompany: (companyId: string) => void;
  refreshMembership: () => Promise<void>;
  isLoading: boolean;
}

const RoleContext = createContext<RoleContextType>({
  role: 'admin',
  isAdmin: true,
  isOffice: false,
  isField: false,
  company: null,
  companyId: null,
  memberships: [],
  colors: officeColors as typeof fieldColors,
  switchCompany: () => {},
  refreshMembership: async () => {},
  isLoading: false,
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<CompanyMembership[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMembership = async () => {
    if (!isCloudEnabled()) {
      // Offline/no Supabase — default to admin
      setMemberships([]);
      setActiveCompanyId(null);
      setIsLoading(false);
      return;
    }

    const client = getSupabase();
    if (!client) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Fetch memberships with company details
      const { data: memberData, error } = await client
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
            id,
            name,
            abn,
            address,
            phone,
            logo_url,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) {
        console.error('Failed to fetch memberships:', error);
        setIsLoading(false);
        return;
      }

      const mapped: CompanyMembership[] = (memberData || []).map((m: any) => ({
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

      setMemberships(mapped);

      // Auto-select first company if none active
      if (mapped.length > 0 && !activeCompanyId) {
        setActiveCompanyId(mapped[0].companyId);
      }
    } catch (err) {
      console.error('Error fetching role:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembership();
  }, []);

  const activeMembership = useMemo(
    () => memberships.find(m => m.companyId === activeCompanyId) || null,
    [memberships, activeCompanyId]
  );

  // Default to 'admin' when no membership found (offline / dev mode)
  const role: UserRole = activeMembership?.role ?? 'admin';
  const company: Company | null = activeMembership?.company ?? null;

  const activeColors = useMemo(
    () => (role === 'field' ? fieldColors : officeColors) as typeof fieldColors,
    [role]
  );

  const switchCompany = (companyId: string) => {
    setActiveCompanyId(companyId);
  };

  return (
    <RoleContext.Provider value={{
      role,
      isAdmin: role === 'admin',
      isOffice: role === 'office',
      isField: role === 'field',
      company,
      companyId: activeCompanyId,
      memberships,
      colors: activeColors,
      switchCompany,
      refreshMembership: fetchMembership,
      isLoading,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

/** Get full role context */
export function useRole() {
  return useContext(RoleContext);
}

/** Shortcut — returns the active color palette based on role */
export function useThemeColors() {
  const { colors } = useContext(RoleContext);
  return colors;
}
