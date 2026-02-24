# RBAC Spec — Role-Based Access Control

## Overview

Transform Variation Shield from single-user to multi-tenant with company-scoped, role-based access.

## Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **admin** | Company owner/director | Everything. User management, billing, company settings, all Office + Field features |
| **office** | QS, contracts admin | Full variation register, pricing, edit variations, print reports, approve/reject, manage projects |
| **field** | Foreman, site supervisor | Capture variations (title, description, photos, voice, location). No pricing/values visible. Cannot edit after submission (or 24hr window). Read-only on own submissions. |

## Data Model Changes

### New Tables

```sql
-- Companies (tenants)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abn TEXT,                    -- Australian Business Number
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Company memberships (user <-> company <-> role)
CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'office', 'field')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(company_id, user_id)
);

-- Invitations (for users not yet signed up)
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'office', 'field')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Modified Tables

```sql
-- projects: add company_id, remove user_id dependency
ALTER TABLE public.projects ADD COLUMN company_id UUID REFERENCES public.companies(id);
-- Migrate: create company per existing user_id, backfill company_id
-- Then: make company_id NOT NULL, drop user_id (or keep as created_by)

ALTER TABLE public.projects RENAME COLUMN user_id TO created_by;
```

### RLS Changes

All RLS policies shift from `user_id = auth.uid()` to company membership:

```sql
-- Helper function: get user's company IDs
CREATE OR REPLACE FUNCTION get_user_company_ids()
RETURNS SETOF UUID AS $$
  SELECT company_id FROM public.company_members
  WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get user's role in a company
CREATE OR REPLACE FUNCTION get_user_role(p_company_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.company_members
  WHERE user_id = auth.uid() AND company_id = p_company_id AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Projects: company members can see, office+admin can create/edit
CREATE POLICY "Company members view projects" ON public.projects
  FOR SELECT USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "Office/admin manage projects" ON public.projects
  FOR INSERT WITH CHECK (
    company_id IN (SELECT get_user_company_ids())
    AND get_user_role(company_id) IN ('admin', 'office')
  );

CREATE POLICY "Office/admin update projects" ON public.projects
  FOR UPDATE USING (
    company_id IN (SELECT get_user_company_ids())
    AND get_user_role(company_id) IN ('admin', 'office')
  );

-- Variations: all members can create (field captures), office+admin can edit
CREATE POLICY "Company members view variations" ON public.variations
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.projects WHERE company_id IN (SELECT get_user_company_ids()))
  );

CREATE POLICY "Members create variations" ON public.variations
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE company_id IN (SELECT get_user_company_ids()))
  );

CREATE POLICY "Office/admin update variations" ON public.variations
  FOR UPDATE USING (
    project_id IN (SELECT id FROM public.projects p
      WHERE p.company_id IN (SELECT get_user_company_ids())
      AND get_user_role(p.company_id) IN ('admin', 'office'))
  );

-- Company members: admin-only management
CREATE POLICY "Admin manages members" ON public.company_members
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true)
  );

CREATE POLICY "Members see own membership" ON public.company_members
  FOR SELECT USING (user_id = auth.uid());
```

## UI Changes

### Field Role (Mobile-first)
- Capture screen: title, description, instruction source, instructed by, photos, voice notes, location
- **Hidden:** estimated_value, all pricing fields
- **Hidden:** Print Register, export, approve/reject buttons
- **Hidden:** Settings > User Management
- **Visible:** Own variation list (read-only after submission), project list
- Status shown as simple: Submitted / In Review / Approved / Disputed

### Office Role (Desktop-first)
- Full variation register with all fields including pricing
- Edit any variation, change status, add notes
- Print Register, PDF export
- Project management (create, edit, archive)
- **Hidden:** User Management, Company Settings, Billing

### Admin Role
- Everything Office has, plus:
- Company Settings (name, ABN, logo)
- User Management (invite users, assign roles, deactivate)
- Billing/subscription management (future)
- Activity log (who changed what)

## Onboarding Flow

1. New user signs up → prompted to "Create a Company" or "Join with invite code"
2. Creating a company → user becomes admin, enters company name + ABN
3. Admin invites users by email → invitation sent with role pre-assigned
4. Invited user signs up → auto-joined to company with assigned role
5. If user already exists → invitation appears in their dashboard

## TypeScript Changes

### domain.ts
```typescript
export type UserRole = 'admin' | 'office' | 'field';

export interface Company {
  id: string;
  name: string;
  abn?: string;
  address?: string;
  phone?: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyMembership {
  id: string;
  companyId: string;
  userId: string;
  role: UserRole;
  isActive: boolean;
  company?: Company;
}

// Update UserProfile
export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  memberships: CompanyMembership[];
  activeCompanyId?: string;
  activeRole?: UserRole;
  createdAt: string;
}
```

### Replace AppModeContext with RoleContext
- Remove PIN-based field/office toggle entirely
- Role comes from Supabase `company_members` table
- `useRole()` hook returns `{ role, isAdmin, isOffice, isField, company }`
- Theme colours can still differ by role if desired

## Migration Strategy

1. Create new tables (companies, company_members, invitations)
2. Add company_id to projects (nullable initially)
3. Migration script: for each existing user, create a company, add as admin, backfill projects
4. Make company_id NOT NULL
5. Update RLS policies
6. Deploy UI changes

## Pricing Implications

This naturally enables per-seat or tiered pricing:
- **Starter:** 1 Admin, 2 Office, 5 Field — $499/mo
- **Growth:** 2 Admin, 5 Office, 20 Field — $999/mo
- **Enterprise:** Unlimited — custom

## Files to Modify

### Supabase
- `supabase/migration.sql` → new migration for RBAC tables + RLS

### Mobile (src/)
- `src/types/domain.ts` → add Company, CompanyMembership, UserRole types
- `src/contexts/AppModeContext.tsx` → replace with RoleContext
- `src/services/auth.ts` → fetch membership on login, expose role
- `src/services/supabase.ts` → may need company-scoped queries
- `src/services/sync.ts` → sync with company_id
- All screens → gate features based on role instead of mode

### Web (web/src/)
- `web/src/lib/types.ts` → mirror domain type changes
- `web/src/lib/supabase.ts` → company-scoped queries
- `web/src/app/login/page.tsx` → onboarding flow (create company / join)
- `web/src/components/Sidebar.tsx` → role-gated navigation
- `web/src/components/AppShell.tsx` → role context provider
- `web/src/app/settings/page.tsx` → admin: user management, company settings
- New: `web/src/app/team/page.tsx` → user management page (admin only)
- All pages → conditionally render based on role
