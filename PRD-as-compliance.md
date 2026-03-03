# PRD: Full AS 4000 / AS 2124 Variation Document Compliance

## Context
Variation Shield prints Variation Requests (VAR-001) and Variation Notices (VN-001). These documents need to be fully compliant with:
- **AS 4000–1997**, Clause 36 (Variations)
- **AS 2124–1992**, Clause 40 (Variations)

The AS 4000/AS 2124 notice language block was already added to both print templates in a prior commit. This PRD covers the remaining gaps: new data fields and document structure.

---

## What Needs Building

### 1. New DB Fields — Variations Table

Add three new columns to `public.variations`:

```sql
-- Migration: 016_as_compliance.sql
ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS claim_type TEXT CHECK (claim_type IN ('cost', 'time', 'cost_and_time')) DEFAULT 'cost';

ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS eot_days_claimed INTEGER;

ALTER TABLE public.variations
  ADD COLUMN IF NOT EXISTS basis_of_valuation TEXT CHECK (basis_of_valuation IN ('agreement', 'contract_rates', 'daywork', 'reasonable_rates'));
```

Save as: `supabase/migrations/016_as_compliance.sql`
Include a comment at top: `-- Apply via Supabase Dashboard → SQL Editor → Run`

### 2. New DB Field — Projects Table

Add contract number to projects:

```sql
-- Part of migration 016
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contract_number TEXT;
```

### 3. TypeScript Types

Update `web/src/lib/types.ts`:

**Variation interface** — add:
```typescript
claim_type?: 'cost' | 'time' | 'cost_and_time';
eot_days_claimed?: number;
basis_of_valuation?: 'agreement' | 'contract_rates' | 'daywork' | 'reasonable_rates';
```

**Project interface** — add:
```typescript
contract_number?: string;
```

### 4. Variation Detail Page — Edit Form

File: `web/src/app/variation/[id]/page.tsx`

Add state variables:
```typescript
const [editClaimType, setEditClaimType] = useState('cost');
const [editEotDays, setEditEotDays] = useState('');
const [editBasisOfValuation, setEditBasisOfValuation] = useState('');
```

Populate on edit open and revise open (same pattern as editDueDate).

Include in both save handlers (regular save + revise save).

Add to edit form UI — place after the Response Due Date field:

**Claim Type** (required, default 'cost'):
```
<select> with options:
- cost → "Cost only"
- time → "Time only"  
- cost_and_time → "Cost & Time"
```

**EOT Days Claimed** (number input, only show when claim_type is 'time' or 'cost_and_time'):
```
<input type="number" min="0" placeholder="e.g. 5" />
<p hint>Calendar days claimed as Extension of Time</p>
```

**Basis of Valuation** (select, required):
```
<select> with options:
- agreement → "By agreement with Principal/Superintendent"
- contract_rates → "By rates/prices in the Contract"
- daywork → "By daywork rates"
- reasonable_rates → "By reasonable rates (no applicable Contract rates)"
```

### 5. Project Settings — Contract Number

File: `web/src/app/settings/page.tsx` (or wherever project editing lives — find it)

Add a "Contract Number" text field to the project edit form. Label: "Contract Number". Placeholder: "e.g. WGT-SC-001". Save to `projects.contract_number`.

### 6. Print Template — Variation Request

File: `web/src/lib/print.ts`, function `buildVariationHtml`

**A. Add new fields to the detail grid** (right column, after Response Due Date):

Contract Number (from project):
```
<div class="field-label">Contract No.</div>
<div class="field-value">${escapeHtml(project.contract_number || '—')}</div>
```

Claim Type:
```
<div class="field-label">Claim Type</div>
<div class="field-value">{cost only | time only | cost & time}</div>
```

EOT Days (only if claim_type includes 'time'):
```
<div class="field-label">Extension of Time Claimed</div>
<div class="field-value">{N} calendar days</div>
```

Basis of Valuation:
```
<div class="field-label">Basis of Valuation</div>
<div class="field-value">{human-readable label}</div>
```

Human-readable labels:
- agreement → "By agreement"
- contract_rates → "By Contract rates/prices"
- daywork → "By daywork rates"
- reasonable_rates → "By reasonable rates"

**B. Add Acknowledgment & Execution Section** — place AFTER the description box and notes, BEFORE the Document Information table:

```html
<div class="avoid-break" style="margin-top:40px; padding-top:24px; border-top:2px solid #E5E7EB;">
  <div style="font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#9CA3AF; margin-bottom:20px;">
    Contractor Execution
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:9pt;">
    <tr>
      <td style="width:50%; padding-right:24px; vertical-align:top;">
        <div style="border-bottom:1px solid #1C1C1E; padding-bottom:2px; margin-bottom:6px; min-height:40px;">&nbsp;</div>
        <div style="color:#6B7280;">Signature</div>
      </td>
      <td style="width:50%; vertical-align:top;">
        <div style="border-bottom:1px solid #1C1C1E; padding-bottom:2px; margin-bottom:6px; min-height:40px;">&nbsp;</div>
        <div style="color:#6B7280;">Date</div>
      </td>
    </tr>
    <tr>
      <td style="padding-top:16px; padding-right:24px; vertical-align:top;">
        <div style="border-bottom:1px solid #1C1C1E; padding-bottom:2px; margin-bottom:6px; min-height:24px;">${escapeHtml(sender.name || variation.requestor_name || '')}</div>
        <div style="color:#6B7280;">Name (Print)</div>
      </td>
      <td style="padding-top:16px; vertical-align:top;">
        <div style="border-bottom:1px solid #1C1C1E; padding-bottom:2px; margin-bottom:6px; min-height:24px;">${escapeHtml(companyName || '')}</div>
        <div style="color:#6B7280;">Company</div>
      </td>
    </tr>
  </table>
</div>

<div class="avoid-break" style="margin-top:32px; padding-top:24px; border-top:1px dashed #D1D5DB;">
  <div style="font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#9CA3AF; margin-bottom:6px;">
    Principal / Superintendent Acknowledgment
  </div>
  <div style="font-size:9pt; color:#6B7280; margin-bottom:20px; line-height:1.5;">
    The undersigned acknowledges receipt of this Variation Request and confirms the direction described herein. 
    Signature below constitutes acceptance of the Variation and agreement to the adjustment of the Contract Sum 
    and/or time for Practical Completion as stated, unless otherwise noted.
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:9pt;">
    <tr>
      <td style="width:50%; padding-right:24px; vertical-align:top;">
        <div style="border-bottom:1px solid #1C1C1E; padding-bottom:2px; margin-bottom:6px; min-height:40px;">&nbsp;</div>
        <div style="color:#6B7280;">Signature (Principal/Superintendent)</div>
      </td>
      <td style="width:50%; vertical-align:top;">
        <div style="border-bottom:1px solid #1C1C1E; padding-bottom:2px; margin-bottom:6px; min-height:40px;">&nbsp;</div>
        <div style="color:#6B7280;">Date</div>
      </td>
    </tr>
    <tr>
      <td style="padding-top:16px; padding-right:24px; vertical-align:top;">
        <div style="border-bottom:1px solid #1C1C1E; padding-bottom:2px; margin-bottom:6px; min-height:24px;">&nbsp;</div>
        <div style="color:#6B7280;">Name (Print)</div>
      </td>
      <td style="padding-top:16px; vertical-align:top;">
        <div style="border-bottom:1px solid #1C1C1E; padding-bottom:2px; margin-bottom:6px; min-height:24px;">${escapeHtml(project.client || '')}</div>
        <div style="color:#6B7280;">Organisation</div>
      </td>
    </tr>
  </table>
  <div style="margin-top:16px; font-size:8.5pt; color:#9CA3AF; line-height:1.5;">
    □ Accepted as submitted &nbsp;&nbsp;&nbsp; □ Accepted subject to the following comments: ___________________________
  </div>
</div>
```

### 7. Print Template — Variation Notice

File: `web/src/lib/print.ts`, function `buildNoticeHtml`

Apply the same Contractor Execution + Principal/Superintendent Acknowledgment section to the Variation Notice print template. Same structure, same content — the VN already has issued_by_name and issued_by_email, use those for the name/company fields.

Also add Contract Number to the notice header area if `project.contract_number` exists.

---

## Acceptance Criteria

- [ ] Migration 016 file exists with correct SQL for all 4 new columns
- [ ] TypeScript types updated for Variation and Project interfaces
- [ ] Variation edit form has: Claim Type (select), EOT Days (number, conditional), Basis of Valuation (select)
- [ ] EOT Days field only visible when claim_type is 'time' or 'cost_and_time'
- [ ] Project settings has Contract Number text field that saves correctly
- [ ] Variation Request print shows: Contract No., Claim Type, EOT Days (if applicable), Basis of Valuation
- [ ] Variation Request print has Contractor Execution block and Principal/Superintendent Acknowledgment block
- [ ] Variation Notice print has the same acknowledgment + signature blocks
- [ ] All new fields gracefully handle null/undefined (show '—' or omit the field)
- [ ] No TypeScript errors
- [ ] Commit with message: `feat: AS 4000/AS 2124 full compliance — claim type, EOT, basis of valuation, acknowledgment blocks`
- [ ] Push to origin/main

## Out of Scope
- Email notifications (separate PRD)
- Capture form (quick capture) — keep it minimal, these fields go on the detail edit only
- PDF generation changes (print template drives PDF already)

## Deploy Note
Migration must be applied manually in Supabase Dashboard after the code ships. Add a comment in the migration file.
