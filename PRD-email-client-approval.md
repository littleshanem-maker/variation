# PRD: Client Email Sending + Client Approval Flow

## Summary
Two related features that complete the variation submission workflow:
1. **Sending domain** — emails go out from `noreply@variationshield.com.au` (currently from `hello@leveragedsystems.com.au`), display name shows the customer's company name
2. **Client approval via email** — Approve/Reject buttons embedded in the variation email, one-click approval updates status in the register automatically

## Context
- Resend is already integrated at `/api/send-variation`
- Variations currently send as PDF attachment from `hello@leveragedsystems.com.au`
- Status is currently updated manually inside the app
- Supabase is the database
- Next.js app at `~/dev/variation/web/`

---

## Feature 1: Sending Domain

### Goal
Variation emails display as: **"Vecta Group via Variation Shield" <noreply@variationshield.com.au>**

The `variationshield.com.au` domain does not exist yet — build the code so it's ready to swap in once the domain is registered. For now, use `noreply@leveragedsystems.com.au` as the from address but structure it so a single env var swap (`RESEND_FROM_DOMAIN`) changes the sending domain across the whole app.

### Changes Required
- Add env var `RESEND_FROM_DOMAIN` (default: `leveragedsystems.com.au`)
- Update `/api/send-variation` to use: `"[Company Name] via Variation Shield <noreply@${RESEND_FROM_DOMAIN}>"`
- Company name comes from the user's company/team name in the database (already available in the API route context)
- Reply-to should be set to the sending user's email so client replies land in their inbox

---

## Feature 2: Client Approval via Email

### Goal
When a variation is submitted to the client, the email contains two buttons: **Approve** and **Reject**. Client clicks one — status updates automatically in the register, PM gets notified.

### Database Changes
Add to `variations` table:
```sql
approval_token UUID DEFAULT gen_random_uuid() UNIQUE,
approval_token_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
client_approval_response TEXT, -- 'approved' | 'rejected'
client_approval_comment TEXT,
client_approved_at TIMESTAMPTZ
```

Create migration file for this (next migration number after current).

### Email Changes
In `/api/send-variation`, include two CTA buttons in the HTML email body (above the PDF note):

```
[ ✓ Approve This Variation ]   [ ✗ Reject This Variation ]
```

Button URLs:
- Approve: `https://app.leveragedsystems.com.au/api/variation-response?token={approval_token}&action=approve`
- Reject: `https://app.leveragedsystems.com.au/api/variation-response?token={approval_token}&action=reject`

Use `NEXT_PUBLIC_APP_URL` env var for the base URL (already set in Vercel).

### New API Route: `/api/variation-response`

**GET** `?token=xxx&action=approve|reject`

Logic:
1. Look up variation by `approval_token`
2. Check token not expired (`approval_token_expires_at > NOW()`)
3. If action = `approve`: redirect to `/variation-response/approved?ref={variation_number}`
4. If action = `reject`: redirect to `/variation-response/reject?token={token}&ref={variation_number}` (reject needs a comment)
5. If token invalid or expired: redirect to `/variation-response/expired`

**POST** `?token=xxx&action=reject` with body `{ comment: string }`

Logic:
1. Validate token
2. Update variation: `status = 'approved'|'rejected'`, `client_approval_response`, `client_approval_comment`, `client_approved_at = NOW()`
3. Insert into `status_changes` table (same pattern as existing status changes)
4. Send Telegram notification to Shane via existing error/notification pattern (or just log — don't block the response)
5. Return success

### New Pages

**`/variation-response/approved`**
- Simple, clean page (no auth required)
- "✓ Variation Approved — Thank you. [Company] has been notified."
- Show variation reference number
- No nav, no login CTA

**`/variation-response/reject`** (GET — shows reject form)
- "Please provide a reason for rejecting this variation (optional)"
- Text area for comment
- Submit button → POST to `/api/variation-response`

**`/variation-response/rejected`** (after successful rejection)
- "Variation Rejected — Thank you. [Company] has been notified."

**`/variation-response/expired`**
- "This link has expired. Please contact [Company] directly."

All pages: clean, mobile-friendly, dark background (#0f172a), white text, Variation Shield branding (purple shield). No sidebar, no nav.

### App UI Changes

On the variation detail page, show client response when present:
- If `client_approval_response = 'approved'`: green badge "Approved via email" + timestamp
- If `client_approval_response = 'rejected'`: red badge "Rejected via email" + timestamp + comment
- These are read-only — the PM can still manually override status as before

### Notification to PM
After a client approves or rejects via email, send a Telegram alert to Shane (use the existing `/api/error-report` pattern or a new `/api/notify` endpoint). Message format:
```
✅ VAR-002 approved by client — Westgate Industrial (APA Group)
```
or
```
❌ VAR-003 rejected by client — Reason: "Cost breakdown not aligned with contract rates"
```

---

## Out of Scope
- Client login or portal
- Email reply parsing
- Multiple approvers
- Approval on notices (variations only for now)

---

## Definition of Done
- [ ] Migration written and included in `/supabase/migrations/`
- [ ] `/api/send-variation` sends from `[Company] via Variation Shield <noreply@{RESEND_FROM_DOMAIN}>` with reply-to set to sender's email
- [ ] Variation emails include Approve/Reject buttons with correct token URLs
- [ ] `/api/variation-response` handles approve (GET) and reject (GET form + POST)
- [ ] Response pages built and mobile-friendly
- [ ] Variation detail page shows client approval status when present
- [ ] Telegram notification fires on approve/reject
- [ ] No regressions on existing send-variation flow
- [ ] All changes committed to `main`

When completely finished, run:
openclaw system event --text "Linus: client approval email feature complete — ready for review" --mode now
