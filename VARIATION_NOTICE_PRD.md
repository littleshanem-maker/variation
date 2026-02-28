# PRD: Variation Notice Feature
**Project:** Variation Shield  
**Repo:** ~/dev/variation  
**Web app:** ~/dev/variation/web  
**Prepared by:** Henry  
**Date:** 2026-02-28  
**Status:** GO — build this now

---

## Background

Variation Shield currently starts at the Variation Request stage. Legally, many contracts (especially Tier 1 head contractors) require a **Variation Notice** to be issued first — a short-form document that alerts the client a variation event has occurred and that there will be cost/time implications. The formal Variation Request (full claim with dollar value) follows after.

This feature adds the Variation Notice as a first step in the workflow, with an option to skip it for contracts that don't require it.

---

## Terminology

- **Variation Notice (VN):** Short-form document sent to client alerting them of a variation event. VN-001 format. Does NOT include the full dollar value — just flags cost/time implication.
- **Variation Request (VR):** The existing Variation record. Full claim with value, description, evidence. What's already built. VAR-001 format.
- **Skip Notice:** Some projects don't require a VN. The existing workflow (straight to VR) must remain available.

---

## What to Build

### 1. Database Migration — `012_variation_notices.sql`

Create file: `supabase/migrations/012_variation_notices.sql`

```sql
-- ============================================================
-- Migration 012: Variation Notice Feature
-- ============================================================

-- 1. Create variation_notices table
CREATE TABLE IF NOT EXISTS public.variation_notices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notice_number     TEXT NOT NULL,         -- VN-001 format
  sequence_number   INTEGER NOT NULL,      -- per-project sequence
  event_description TEXT NOT NULL,
  event_date        DATE NOT NULL,
  cost_flag         BOOLEAN NOT NULL DEFAULT true,
  time_flag         BOOLEAN NOT NULL DEFAULT false,
  estimated_days    INTEGER,               -- rough time implication, nullable
  contract_clause   TEXT,                  -- e.g. "Clause 36.1", nullable
  issued_by_name    TEXT,
  issued_by_email   TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'issued', 'acknowledged')),
  issued_at         TIMESTAMPTZ,
  acknowledged_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add notice_id FK to variations (nullable — null = notice skipped)
ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS notice_id UUID REFERENCES public.variation_notices(id) ON DELETE SET NULL;

-- 3. Add notice_required to projects (default false — existing projects unaffected)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS notice_required BOOLEAN NOT NULL DEFAULT false;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_variation_notices_project_id
  ON public.variation_notices(project_id);

CREATE INDEX IF NOT EXISTS idx_variation_notices_company_id
  ON public.variation_notices(company_id);

CREATE INDEX IF NOT EXISTS idx_variations_notice_id
  ON public.variations(notice_id);

-- 5. RLS — mirror the pattern used on variations table
ALTER TABLE public.variation_notices ENABLE ROW LEVEL SECURITY;

-- Members of the company can read notices for their company
CREATE POLICY "Company members can read notices"
  ON public.variation_notices FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Field/office/admin can insert
CREATE POLICY "Company members can insert notices"
  ON public.variation_notices FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Non-field members can update
CREATE POLICY "Office and admin can update notices"
  ON public.variation_notices FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
```

---

### 2. TypeScript Types

**File:** `web/src/lib/types.ts`

Add to the existing types:

```typescript
export interface VariationNotice {
  id: string;
  project_id: string;
  company_id: string;
  notice_number: string;        // VN-001 format
  sequence_number: number;
  event_description: string;
  event_date: string;           // ISO date string
  cost_flag: boolean;
  time_flag: boolean;
  estimated_days?: number;
  contract_clause?: string;
  issued_by_name?: string;
  issued_by_email?: string;
  status: 'draft' | 'issued' | 'acknowledged';
  issued_at?: string;
  acknowledged_at?: string;
  created_at: string;
  updated_at: string;
}
```

Also update the `Variation` interface to add:
```typescript
notice_id?: string;  // FK to variation_notices, null if notice skipped
```

And update the `Project` interface to add:
```typescript
notice_required?: boolean;
```

---

### 3. New Page: Variation Notice Detail

**File:** `web/src/app/notice/[id]/page.tsx`

This page shows a single Variation Notice. Model it on the existing `variation/[id]/page.tsx` but simpler.

**Sections to include:**
1. **Header card:** Notice number (VN-001), project name + client, status badge, event date, issued date (if issued)
2. **Event description:** Full text of what happened
3. **Implications card:** Cost flag (Yes/No), Time flag (Yes/No), estimated days (if set), contract clause (if set)
4. **Issued by:** Name and email
5. **Linked Variation Request:** If `variation_id` exists (i.e., a VR has been created from this notice), show a card linking to `/variation/[id]`. If not yet created, show a button "Create Variation Request from this Notice"
6. **Status history** (use the same status_changes pattern — but store on the notice, not variation)

**Actions available (top right, matching existing button style):**
- If status is `draft`: "Issue Notice" button → sets status to `issued`, records `issued_at`
- If status is `issued` and no linked variation: "Create Variation Request" button → navigates to new variation form pre-populated with notice data
- If status is `issued` and no linked variation: "Mark Acknowledged" button → sets status to `acknowledged`
- Delete button (draft only, same pattern as variation delete)

**Notice number generation:** Query `SELECT MAX(sequence_number) FROM variation_notices WHERE project_id = ?`, increment by 1, format as `VN-{padded 3 digits}`.

---

### 4. New Page: Create Variation Notice

**File:** `web/src/app/notice/new/page.tsx`

Simple form. URL should accept `?projectId=xxx` query param to pre-select the project.

**Fields:**
- Project (dropdown, pre-selected if projectId param present)
- Event Date (date picker, defaults to today)
- Event Description (textarea, required) — what happened on site
- Cost Implication (Yes/No toggle, defaults Yes)
- Time Implication (Yes/No toggle, defaults No)
- Estimated Days (number input, shown only if time_flag = true)
- Contract Clause (text input, optional, placeholder "e.g. Clause 36.1 AS 4000")
- Issued By Name (text, pre-fill from user profile)
- Issued By Email (text, pre-fill from user profile)

**Save as Draft** and **Issue Immediately** buttons.

On save: insert to `variation_notices`, redirect to `/notice/[id]`.

---

### 5. Update: Variation Detail Page

**File:** `web/src/app/variation/[id]/page.tsx`

If the variation has a `notice_id`:
- Add a "Variation Notice" info card at the top of the page (above the header card), showing:
  - Notice number (e.g. VN-001)
  - Status badge
  - Event date
  - Link: "View Notice →" → `/notice/[notice_id]`

This card should be subtle — a light banner, not a full section. Something like:

```
[VN-001 — Issued 28 Feb 2026]  View Notice →
```

---

### 6. Update: Project Detail Page

**File:** `web/src/app/project/[id]/page.tsx`

Add a "Variation Notices" section above the Variations list (or as a tab if tabs exist).

Show a table of all notices for the project:
- Notice number
- Event description (truncated to 60 chars)
- Event date
- Status badge
- Linked VR (show VAR-001 if linked, "—" if not)
- "View" link

Add a "New Notice" button (links to `/notice/new?projectId=xxx`).

---

### 7. Update: Project Settings / New Project Form

**Files:** 
- `web/src/app/project/new.tsx` (or equivalent new project page)
- `web/src/app/settings/page.tsx` (if project settings live here — check the codebase)

Add a toggle: **"Variation Notices required for this project"**
- Label: "Require Variation Notice before submitting a Variation Request"  
- Sublabel: "Enable for Tier 1 contracts that require formal notice of variation events"
- Default: OFF

If this project setting is accessible on the project detail/edit page, add it there too.

---

### 8. Update: New Variation Form (Capture Flow)

**File:** `web/src/app/capture/[projectId].tsx` and/or wherever new variations are created in the web app

When a user creates a new variation:
1. If the project has `notice_required = true`: show an info banner at the top of the form: *"This project requires a Variation Notice. Consider issuing a notice before submitting this request."* with a link "Create Notice First →" that goes to `/notice/new?projectId=xxx`. The user can still proceed with the VR directly (skip is always available).
2. Also add a field on the new variation form: **"Link to Variation Notice"** — a dropdown/search of existing issued notices for this project that don't yet have a linked variation. Optional. Allows linking a VR to a previously-created VN.

---

### 9. Status Badge Updates

**File:** `web/src/components/StatusBadge.tsx`

Add three new status values:
- `vn-draft` → label "VN Draft", style: grey (same as current draft)
- `vn-issued` → label "VN Issued", style: amber/orange (similar to submitted)
- `vn-acknowledged` → label "VN Acknowledged", style: green (similar to approved)

Or just use the string values `draft`, `issued`, `acknowledged` with a different colour scheme since these are notice statuses, not variation statuses. Check how StatusBadge currently works and extend it cleanly.

---

### 10. PDF Export for Notice

**File:** `web/src/lib/print.ts`

Add a new function `printNotice(notice, project, companyName)` that generates a print layout for the Variation Notice document.

The notice PDF should be clean, professional, and short (1 page ideally):

```
[Company Logo / Name]                          VARIATION NOTICE
                                                VN-001

Project:     [Project Name]
Client:      [Client Name]  
Contract Ref: [Project Reference]
Date:         [Event Date]
Issued:       [Issued At date]

TO: [Client name]

TAKE NOTICE that the undersigned hereby gives notice pursuant to the contract 
that a variation event has occurred as described below.

DESCRIPTION OF EVENT:
[event_description]

COST IMPLICATION:    ☑ Yes  ☐ No
TIME IMPLICATION:    ☑ Yes  ☐ No
ESTIMATED DAYS:      [estimated_days or —]
CONTRACT CLAUSE:     [contract_clause or —]

A formal Variation Request will be submitted in accordance with the contract.

Issued by: [issued_by_name]
Email:     [issued_by_email]

[Notice Number]                                [Company Name]
```

Add a "Print Notice" button to the notice detail page (same pattern as "Print Variation" on variation detail).

---

## What NOT to Change

- Do not change the existing variation workflow for projects where `notice_required = false`
- Do not change the VAR-001 numbering system
- Do not break existing status transitions
- Do not change the existing PDF export for Variation Requests
- Do not change the existing auth/RBAC model — notices follow the same company-scoped access pattern

---

## Acceptance Criteria

- [ ] `variation_notices` table exists in Supabase with correct schema and RLS
- [ ] `notice_id` column exists on `variations` table (nullable)  
- [ ] `notice_required` column exists on `projects` table (default false)
- [ ] Can create a Variation Notice from `/notice/new`
- [ ] Notice numbers generate as VN-001, VN-002, etc. per project
- [ ] Can view a notice at `/notice/[id]`
- [ ] Can issue a notice (draft → issued)
- [ ] Can mark a notice as acknowledged (issued → acknowledged)
- [ ] Can create a Variation Request linked to a notice
- [ ] Variation detail page shows linked notice banner when notice_id is set
- [ ] Project detail page shows Variation Notices section
- [ ] Project settings toggle for `notice_required` works
- [ ] New variation form shows notice banner when project has `notice_required = true`
- [ ] Print Notice generates a clean 1-page PDF
- [ ] StatusBadge handles notice statuses
- [ ] Existing variation workflow unchanged for projects without notice_required
- [ ] All new UI matches existing design system (colours, typography, component patterns from existing pages)
- [ ] No TypeScript errors
- [ ] Run `npm run build` in `web/` — must pass with no errors

---

## Design System Reference

Match existing styles exactly. Key values from the codebase:
- Primary: `#1B365D`
- Text primary: `#1C1C1E`
- Text secondary: `#6B7280`
- Text muted: `#9CA3AF`
- Border: `#E5E7EB`
- Background subtle: `#F8F8F6`
- Border radius: `rounded-md`
- Input class: `w-full px-3 py-2 text-[14px] border border-[#E5E7EB] rounded-md focus:ring-1 focus:ring-[#1B365D] focus:border-[#1B365D] outline-none`
- Label class: `block text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.02em] mb-1`
- Card: `bg-white rounded-md border border-[#E5E7EB] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]`

---

## Completion

When all acceptance criteria are met and `npm run build` passes:

1. Run `git add -A && git commit -m "feat: add Variation Notice workflow (VN-001 format, linked to Variation Requests)"`
2. Run this command to notify Henry: `openclaw system event --text "Linus done: Variation Notice feature built and committed. Build passing." --mode now`
