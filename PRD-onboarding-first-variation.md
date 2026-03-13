# PRD: Onboarding → First Variation in Under 3 Minutes

**Priority:** High — must ship before demos (Tue 17 Mar)  
**Owner:** Linus  
**Goal:** A brand-new user signs up and captures their first variation in under 3 minutes, with zero confusion about what to do next.

---

## Problem

After signup, users land on a blank dashboard. There is no guidance on what to do. They must figure out on their own: create a project → find the capture flow → fill in a variation. Most won't.

The current onboarding (`/onboarding`) only collects company branding (name, address, phone, logo) — optional details that don't deliver any value. After saving, users land on a blank dashboard with no direction.

---

## Success Criteria

- [ ] New user lands on `/onboarding` and is guided to create a project before hitting the dashboard
- [ ] After project creation, user is taken directly to `/capture` with the project pre-selected
- [ ] First variation can be submitted with **one required field** (title)
- [ ] After first variation is saved, user sees a success state and lands on the register
- [ ] Dashboard shows a guided empty state when 0 projects or 0 variations exist (not blank cards)
- [ ] Total time from signup → first variation captured: **under 3 minutes**

---

## Changes Required

### 1. Extend `/onboarding` — Add Project Creation Step

**File:** `src/app/onboarding/page.tsx`

**Current state:** Single step — company name (required), address/phone/logo (optional). On save → redirects to `/`.

**New state:** Two-step flow.

**Step 1 — Company Setup (unchanged)**
- Company name (required)
- Address, phone, logo (optional)
- Button: "Next →" (not "Save & go to dashboard")
- Skip button: "Skip for now" (skips company details, goes to Step 2 with default company name)

**Step 2 — Create Your First Project**
Show this step after company name is saved.

UI:
```
────────────────────────────────
  Step 2 of 2 — Your first project

  "Now let's set up a project so you 
   can start capturing variations."

  [ Project name * ]
    placeholder: "e.g. Austin Health — Level 6 Fitout"

  [ Client / Head contractor ]  (optional)
    placeholder: "e.g. Multiplex"

  [ Create project → ]   (primary button)
  [ Skip for now ]       (text link)
────────────────────────────────
```

**On "Create project":**
1. Insert into `projects` table: `{ name, client (if provided), company_id, created_by: user.id, is_active: true, notice_required: false }`
2. Redirect to: `/capture?project=<new_project_id>&onboarding=true`

**On "Skip for now":**
- Redirect to `/` (existing behaviour)

**Progress indicator:**
- Show "Step 1 of 2" / "Step 2 of 2" as small text above the header on both steps

---

### 2. Simplify `/capture` for First-Time Users

**File:** `src/app/capture/page.tsx`

When `?onboarding=true` is present in the URL:

**A — Pre-select and lock the project**
- Read `?project=<id>` from URL params
- Pre-select that project in the project dropdown
- Make the project field read-only (show as plain text, not a dropdown): `"Project: Austin Health — Level 6 Fitout"`

**B — Show a welcome banner at the top**
```
┌─────────────────────────────────────────┐
│ ⚡ You're 60 seconds from your first    │
│    captured variation.                  │
│    Fill in the title and hit Save.      │
└─────────────────────────────────────────┘
```
Style: indigo background (`#EEF2FF`), indigo border, dark text. Dismissible (×).

**C — Collapse optional fields by default**
Currently the capture form shows all fields. When `?onboarding=true`:
- Show only: **Title** (required)
- Show a collapsed section: "Add more details ▾" that expands to show: value, description, instruction source, instructed by, response due date, photos
- Advanced fields (contract clause, claim type, EOT days) remain collapsed regardless

This makes the minimum required action obvious: type a title, hit Save.

**After save → redirect to `/variations?onboarding=success`** (not back to capture)

---

### 3. Success State After First Variation

**File:** `src/app/variations/page.tsx`

When `?onboarding=success` is in the URL, show a dismissible success banner at the top of the register:

```
┌────────────────────────────────────────────────────────────────┐
│ ✅  First variation captured. Welcome to Variation Shield.     │
│     Every variation you capture from here is protected.   [×] │
└────────────────────────────────────────────────────────────────┘
```

Style: green background (`#F0FDF4`), green border (`#BBF7D0`), green text (`#166534`).

Banner disappears when dismissed (local state, no persistence needed).

---

### 4. Dashboard Empty States

**File:** `src/app/page.tsx`

Replace blank/zero-state dashboard content with guided prompts based on data state.

**State A: 0 projects**

Replace the Financial Health chart and KPI cards with:
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   🛡️  Welcome to Variation Shield                   │
│                                                     │
│   Start by creating your first project.             │
│   Then capture a variation in under 60 seconds.     │
│                                                     │
│   [ Create your first project → ]                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

The button links to `/onboarding` (which now has Step 2 — project creation).

**State B: Projects exist, 0 variations**

Show KPI cards as normal (all zeros) but add a banner above the Urgent Attention Feed:
```
┌─────────────────────────────────────────────────────┐
│  ⚡ No variations yet.                               │
│     Capture one now — it takes 60 seconds on site.  │
│     [ Capture a variation → ]                       │
└─────────────────────────────────────────────────────┘
```

Button links to `/capture`.

**State C: Variations exist → normal dashboard (no changes)**

---

## Data / Schema

No schema changes required. The project insert uses existing `projects` table fields:

```typescript
{
  id: uuid(),
  company_id: companyId,
  created_by: userId,
  name: projectName.trim(),
  client: clientName.trim() || null,
  is_active: true,
  notice_required: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
```

---

## Out of Scope (do not build)

- Team invite flow (separate task)
- Company branding enforcement (address/logo not required to proceed)
- Onboarding checklist / progress tracker (too heavy for now)
- Any changes to the existing `/capture` flow for non-onboarding users
- Changes to `/signup`

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/onboarding/page.tsx` | Add Step 2 — project creation |
| `src/app/capture/page.tsx` | Handle `?onboarding=true` + `?project=<id>` |
| `src/app/variations/page.tsx` | Handle `?onboarding=success` banner |
| `src/app/page.tsx` | Empty state logic (State A + State B) |

---

## Acceptance Test

1. Sign up as a brand-new user
2. Complete Step 1 (company name)
3. Complete Step 2 (project name only — no client)
4. Land on `/capture` — project is pre-selected, welcome banner visible
5. Type a variation title. Hit Save.
6. Land on `/variations` with green success banner
7. Dashboard shows the variation in the register
8. Total elapsed time: under 3 minutes

**Also test:**
- Skip on Step 1 → goes to Step 2
- Skip on Step 2 → goes to dashboard (existing behaviour)
- Non-onboarding `/capture` visit → no banner, no locked project field, all fields shown as normal
- Existing users → no change to dashboard (they have data)
