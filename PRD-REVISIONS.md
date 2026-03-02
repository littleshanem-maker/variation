# PRD — Variation Revision System

**Feature:** VAR-001 → VAR-001 Rev 1 → VAR-001 Rev 2  
**Date:** 2026-03-02  
**Files:** migration, types, utils, variation detail, project page, variations register, print

---

## What It Does

When a client requests a change to a submitted or approved variation, the office/admin user creates a **revision**. The revision:
- Gets the same VAR number with a revision suffix: VAR-001 Rev 1, VAR-001 Rev 2
- Starts as a fresh draft (all original fields pre-filled, ready to edit)
- The original is not deleted — it stays as the historical record

---

## Database — Migration 014

File: `supabase/migrations/014_variation_revisions.sql`

```sql
ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.variations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_variations_parent ON public.variations(parent_id);
```

- `revision_number = 0` → original (existing rows unaffected)
- `revision_number = 1` → Rev 1, etc.
- `parent_id` → points to the direct parent (original or previous revision)

---

## TypeScript Types — `src/lib/types.ts`

Add to `Variation` interface:
```ts
revision_number?: number;   // 0 = original, 1 = Rev 1, etc. Default 0.
parent_id?: string;         // null for originals
```

---

## Display Logic — `src/lib/utils.ts`

Update `getVariationNumber`:
```ts
export function getVariationNumber(variation: {
  variation_number?: string;
  sequence_number: number;
  revision_number?: number;
}): string {
  const base = variation.variation_number ?? formatVariationNumber(variation.sequence_number);
  const rev = variation.revision_number ?? 0;
  return rev > 0 ? `${base} Rev ${rev}` : base;
}
```

---

## Variation Detail Page — `src/app/variation/[id]/page.tsx`

### 1. Add canRevise logic (near canEdit/canDelete)
```ts
const canRevise = !isField
  && ['submitted', 'approved', 'disputed'].includes(variation.status);
```

### 2. Add "Create Revision" button in the action button row
Place next to the Delete button. Style: secondary/outline, blue tone.

```tsx
{canRevise && (
  <button onClick={handleCreateRevision} disabled={creating}>
    {creating ? 'Creating...' : 'Revise'}
  </button>
)}
```

### 3. handleCreateRevision function
```ts
async function handleCreateRevision() {
  if (!variation || !project) return;
  setCreating(true);
  const supabase = createClient();

  // Find highest revision_number for this sequence in this project
  const { data: siblings } = await supabase
    .from('variations')
    .select('revision_number')
    .eq('project_id', variation.project_id)
    .eq('sequence_number', variation.sequence_number)
    .order('revision_number', { ascending: false })
    .limit(1);

  const nextRev = ((siblings?.[0]?.revision_number ?? 0) + 1);

  const { data: newVar, error } = await supabase
    .from('variations')
    .insert({
      project_id: variation.project_id,
      sequence_number: variation.sequence_number,
      revision_number: nextRev,
      parent_id: variation.id,
      title: variation.title,
      description: variation.description,
      instruction_source: variation.instruction_source,
      instructed_by: variation.instructed_by,
      reference_doc: variation.reference_doc,
      estimated_value: variation.estimated_value,
      notes: variation.notes,
      status: 'draft',
      captured_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !newVar) {
    setCreating(false);
    return;
  }

  router.push(`/variation/${newVar.id}`);
}
```

Add `const [creating, setCreating] = useState(false);` to state.

### 4. Show revision badge in the header
Below or next to the VAR number, if `revision_number > 0`:
```tsx
{(variation.revision_number ?? 0) > 0 && (
  <span className="text-[11px] font-semibold uppercase tracking-wide text-white bg-[#1B365D] px-2 py-0.5 rounded">
    Rev {variation.revision_number}
  </span>
)}
```

### 5. Revision history section (below variation details)
Query: all variations with same `project_id` AND same `sequence_number`, ordered by `revision_number`.
Show as a compact list — VAR-001, VAR-001 Rev 1, VAR-001 Rev 2 — with status badge and link.
Current variation highlighted.

```tsx
{revisions.length > 1 && (
  <div className="mt-6">
    <h3 className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide mb-2">Revision History</h3>
    <div className="space-y-1">
      {revisions.map(r => (
        <Link key={r.id} href={`/variation/${r.id}`}
          className={`flex items-center justify-between px-3 py-2 rounded-md text-[13px] ${
            r.id === variation.id ? 'bg-[#F0F4FF] font-semibold' : 'hover:bg-[#F8F8F6]'
          }`}
        >
          <span>{getVariationNumber(r)}</span>
          <StatusBadge status={r.status} />
        </Link>
      ))}
    </div>
  </div>
)}
```

Load `revisions` in `loadVariation()`:
```ts
const { data: revisionData } = await supabase
  .from('variations')
  .select('id, sequence_number, variation_number, revision_number, status')
  .eq('project_id', variation.project_id)
  .eq('sequence_number', variation.sequence_number)
  .order('revision_number', { ascending: true });
setRevisions(revisionData ?? []);
```

Add `const [revisions, setRevisions] = useState<Variation[]>([]);` to state.

---

## Project Page — `src/app/project/[id]/page.tsx`

In the variations table, update the VAR number cell to use the updated `getVariationNumber` (which now includes revision). No other changes needed — it already calls `getVariationNumber`.

Also: if a variation has `revision_number > 0`, show a small "Rev N" badge next to the number in the list.

---

## Variations Register — `src/app/variations/page.tsx`

Same as project page — `getVariationNumber` update handles the number display automatically.

---

## Print/PDF — `src/lib/print.ts`

Update any place that formats the variation number to use `getVariationNumber` including revision. The print header for a variation should show "VAR-001 Rev 1" not "VAR-001" if it's a revision.

---

## Supabase RLS

The `INSERT` policy on `variations` already allows company members to insert (checked via project company_id). No new policies needed — revisions are just new rows.

---

## Testing Checklist

- [ ] `revision_number` defaults to 0 for all existing variations — confirm in Supabase
- [ ] "Revise" button appears on submitted/approved variations for admin + office users
- [ ] "Revise" button NOT shown for field users or draft variations
- [ ] Clicking Revise creates a new row with `revision_number = parent + 1`, `parent_id` set, `status = 'draft'`
- [ ] New revision opens immediately in the variation detail page
- [ ] `getVariationNumber` returns "VAR-001 Rev 1" for revision_number=1
- [ ] Revision history section shows all revisions of same sequence_number, current highlighted
- [ ] Revision history links navigate correctly
- [ ] Project page variation list shows "VAR-001 Rev 1" correctly
- [ ] Variations register shows revision numbers correctly
- [ ] Print/PDF shows correct revision number
- [ ] Creating Rev 2 from Rev 1 works correctly (revision_number = 2)
- [ ] Deploy to Vercel, test on live app

---

## Done Criteria

1. Migration 014 applied in Supabase production
2. App deployed to Vercel
3. Revise button works end-to-end: click → new draft variation opens with parent data pre-filled
4. Revision history visible on detail page
5. All list views show correct revision numbers
6. Report back to Henry with confirmation + any edge cases found
