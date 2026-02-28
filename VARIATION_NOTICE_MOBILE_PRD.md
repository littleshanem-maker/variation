# PRD: Variation Notice — Mobile App
**Project:** Variation Shield (React Native / Expo)
**Repo:** ~/dev/variation (app/ and src/ directories)
**Prepared by:** Henry
**Date:** 2026-02-28
**Status:** GO — build this now

---

## Context

The web app now has Variation Notice support (migration 012 already run in Supabase).
This spec adds the Notice flow to the React Native mobile app.

The mobile app is the **field tool** — the primary place a notice gets created.
The user is on site, something happens, they pull out their phone and log a VN in 60 seconds
before the work starts. That's the core use case. Keep it fast and simple.

---

## Architecture Notes (read before writing any code)

- The mobile app uses **local SQLite** via Drizzle ORM (see `src/db/`)
- Data syncs to Supabase via `src/services/sync.ts`
- Look at `src/db/variationRepository.ts` and `src/db/schema.ts` to understand the DB patterns
- Look at `src/services/sync.ts` to understand how Supabase sync works
- Look at `app/capture/[projectId].tsx` for the step-wizard pattern (mobile)
- Look at `app/project/[id].tsx` for the project screen pattern
- Field vs Office mode matters — check `useAppMode()` hook
- Theme/colours via `useThemeColors()` and `AppModeContext`
- Match styling exactly to existing screens — same spacing, borderRadius, typography tokens

---

## What to Build

### 1. Local DB Schema — add variation_notices table

**File:** `src/db/schema.ts`

Add a new table to the Drizzle schema:

```typescript
export const variationNotices = sqliteTable('variation_notices', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  noticeNumber: text('notice_number').notNull(),       // VN-001 format
  sequenceNumber: integer('sequence_number').notNull(),
  eventDescription: text('event_description').notNull(),
  eventDate: text('event_date').notNull(),             // ISO date string
  costFlag: integer('cost_flag', { mode: 'boolean' }).notNull().default(true),
  timeFlag: integer('time_flag', { mode: 'boolean' }).notNull().default(false),
  estimatedDays: integer('estimated_days'),
  contractClause: text('contract_clause'),
  issuedByName: text('issued_by_name'),
  issuedByEmail: text('issued_by_email'),
  status: text('status').notNull().default('draft'),   // draft | issued | acknowledged
  issuedAt: text('issued_at'),
  acknowledgedAt: text('acknowledged_at'),
  variationId: text('variation_id'),                   // linked VR (nullable)
  syncStatus: text('sync_status').notNull().default('pending'), // pending | synced | failed
  remoteId: text('remote_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

After adding to schema, add the migration in `src/db/index.ts` using the same pattern as existing migrations (look at how the existing tables are added).

---

### 2. Notice Repository

**File:** `src/db/noticeRepository.ts`

Model on `variationRepository.ts`. Implement:

```typescript
// Get next sequence number for a project's notices
getNextNoticeSequence(projectId: string): Promise<number>

// Create a new notice
createNotice(params: {
  projectId: string;
  eventDescription: string;
  eventDate: string;
  costFlag: boolean;
  timeFlag: boolean;
  estimatedDays?: number;
  contractClause?: string;
  issuedByName?: string;
  issuedByEmail?: string;
}): Promise<VariationNotice>

// Get all notices for a project
getNoticesForProject(projectId: string): Promise<VariationNotice[]>

// Get a single notice
getNoticeById(id: string): Promise<VariationNotice | null>

// Update notice status
updateNoticeStatus(id: string, status: 'draft' | 'issued' | 'acknowledged'): Promise<void>

// Link a variation to a notice
linkVariationToNotice(noticeId: string, variationId: string): Promise<void>
```

Notice number generation: query MAX(sequence_number) for the project, increment, format as `VN-${String(seq).padStart(3, '0')}`.

---

### 3. Domain Types

**File:** `src/types/domain.ts`

Add:

```typescript
export interface VariationNotice {
  id: string;
  projectId: string;
  noticeNumber: string;
  sequenceNumber: number;
  eventDescription: string;
  eventDate: string;
  costFlag: boolean;
  timeFlag: boolean;
  estimatedDays?: number;
  contractClause?: string;
  issuedByName?: string;
  issuedByEmail?: string;
  status: 'draft' | 'issued' | 'acknowledged';
  issuedAt?: string;
  acknowledgedAt?: string;
  variationId?: string;
  syncStatus: string;
  remoteId?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 4. New Notice Capture Screen

**File:** `app/notice/new.tsx`

URL receives `?projectId=xxx` query param.

This is a **simple, fast single-screen form** — NOT a multi-step wizard. The whole point is speed.

**Layout (mobile):**
```
[← Back]    New Notice    [Save]

─────────────────────────────

WHAT HAPPENED *
[Large text input — 4 lines, autofocus]
"Describe the event on site..."

EVENT DATE
[Date — defaults to today]

IMPLICATIONS
[Cost ☑]   [Time ☐]

ESTIMATED DAYS (shown if timeFlag = true)
[Number input]

CONTRACT CLAUSE (optional)
[Text input — "e.g. Clause 36.1 AS 4000"]

─────────────────────────────
[Save as Draft]      [Issue Now]
```

**Save as Draft:** creates notice with status `draft`, navigates back to project.
**Issue Now:** creates notice with status `issued`, sets `issuedAt` to now, navigates back.

**Required field:** event description only. Everything else optional.

**Pre-fill issued_by from auth:** call `getCurrentUser()` and pre-fill issuedByName + issuedByEmail (same pattern as capture screen does for requestorName/requestorEmail). Don't show these fields — just fill them silently.

---

### 5. Notice Detail Screen

**File:** `app/notice/[id].tsx`

Model on `app/variation/[id].tsx` but much simpler.

**Sections:**
1. Header: notice number (VN-001), project name, status badge
2. Event description (full text)
3. Details row: event date, cost flag, time flag, estimated days (if set), contract clause (if set)
4. Issued by (name + email if set)
5. Linked Variation Request — if `variationId` is set, show a tappable row "VAR-001 →" that navigates to `/variation/[variationId]`

**Actions (top right):**
- If status `draft`: "Issue" button → updates status to `issued`
- If status `issued` and no linked variation: "New Variation" button → navigates to `/capture/[projectId]` (the variation will need to be manually linked for now — full linking can come later)
- Back button → returns to project

**No edit mode needed for MVP.** Keep it read + status advance only.

---

### 6. Update Project Detail Screen

**File:** `app/project/[id].tsx`

Add a **Notices section** above the variations list (or as a collapsible row).

On load, fetch `getNoticesForProject(id)` alongside the existing variations query.

**If there are notices:** show a compact horizontal scroll row of notice pills above the variations table:
```
NOTICES   [VN-001 Draft ×]  [VN-002 Issued ✓]  [+ New Notice]
```

Each pill is tappable → navigates to `/notice/[id]`.

**If no notices:** just show a subtle "New Notice" link next to the "New Variation" button.

**New Notice button:** add a secondary button alongside "New Variation" in the filter row:
- Desktop (isWeb): button labeled "New Notice" with `warning-outline` icon
- Mobile field mode: add to the bottom bar as a secondary action below "New Variation"
- Mobile office mode: add to filter row

Taps → `/notice/new?projectId=xxx`

---

### 7. Sync Service Update

**File:** `src/services/sync.ts`

Add notice sync alongside the existing variation sync. Follow the exact same pattern.

On sync push: for each notice with `syncStatus = 'pending'`:
- Insert to `variation_notices` table in Supabase
- Set `remoteId` to the Supabase-returned id
- Set `syncStatus = 'synced'`
- Include `company_id` (get from project's company_id, same as variation sync does)

On sync pull: fetch notices from Supabase for the current company where `updated_at > lastSyncAt`, upsert locally.

---

## What NOT to Build

- No photo/voice evidence on notices (that's what the Variation Request is for)
- No PDF export from mobile for notices (web handles that)
- No editing notices after creation (MVP — status advance only)
- Don't change the existing variation capture flow
- Don't change existing sync logic for variations

---

## Acceptance Criteria

- [ ] `variation_notices` table exists in local SQLite schema
- [ ] DB migration runs cleanly on fresh install
- [ ] Can create a notice from `/notice/new?projectId=xxx`
- [ ] Notice numbers generate as VN-001, VN-002, etc. per project
- [ ] Can save as draft or issue immediately
- [ ] Can view notice at `/notice/[id]`
- [ ] Can advance status draft → issued from notice detail
- [ ] Project screen shows notices and a New Notice button
- [ ] Notices sync to Supabase (push)
- [ ] No TypeScript errors
- [ ] Existing variation capture flow unchanged
- [ ] Styling matches existing screens exactly (same colours, spacing, component patterns)

---

## Completion

When all acceptance criteria are met:

1. Run: `cd /Users/shanelittle/dev/variation && npx tsc --noEmit` — fix all TypeScript errors
2. Run: `git add -A && git commit -m "feat: add Variation Notice to mobile app (VN-001, field capture, Supabase sync)"`
3. Run: `openclaw system event --text "Linus done: Variation Notice mobile feature built and committed." --mode now`
