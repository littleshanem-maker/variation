# PRD — Variation Shield Free Tier
**Date:** 2026-03-24
**Priority:** High
**Branch:** work on `main` — commit incrementally, deploy via git push

---

## Objective

Add a free signup path (no credit card) that lets prospective customers create an account, build one project, and log up to 3 variations. The goal is to get users to their first real variation on a real job — creating the contrast between using Variation Shield and not using it. Once they have timestamped, documented variations with PDFs, going back to spreadsheets feels like a step backwards.

---

## Changes from original brief (incorporated):

1. **Variation limit is 3, not 5** — enough to feel the workflow, not enough to run a full job
2. **No "primary trade" field at signup** — collect at upgrade, not at signup. Every extra field loses conversions.
3. Free signup form: email + password + full name + company name ONLY

---

## Tasks

- [ ] **Database: Add plan columns to companies table**
  - Migration: add `plan` (enum 'free'|'pro', default 'free'), `variation_count` (int, default 0), `variation_limit` (int, default 3), `project_limit` (int, default 1), `upgraded_at` (timestamp nullable) to `companies` table
  - Migration file: `supabase/migrations/035_free_tier.sql`
  - Update `provision_new_account` RPC to set plan='free', variation_limit=3, project_limit=1 on new accounts
  - Pro accounts: variation_limit=null (unlimited), project_limit=null (unlimited)

- [ ] **Backend: Enforce free tier limits**
  - On variation CREATE: check company variation_count < variation_limit (or limit is null). If at limit, return 402 with `{ error: 'limit_reached', count: X, limit: Y, total_value: Z }` where total_value is sum of estimated_value across their variations
  - On project CREATE: check company project_count < project_limit (or null). Return 402 with `{ error: 'project_limit_reached' }` if at limit
  - Increment variation_count on variation creation, decrement on deletion — use a Supabase trigger or RPC
  - Add a DB trigger: `update_variation_count` on INSERT/DELETE to variations table
  - Free users: hide "Invite Team Member" — show upgrade prompt instead
  - Free users: "Send to Client" generates a watermarked PDF (add footer: "Generated with Variation Shield — variationshield.com.au / Upgrade to Pro to remove this watermark") but does NOT create the client approval/reject link. The email sends but no approval buttons.

- [ ] **Free signup page: /signup/free**
  - New page at `web/src/app/signup/free/page.tsx`
  - Form fields: email, password, full name, company name ONLY (no trade, no phone, no ABN, no card)
  - On submit: Supabase auth.signUp → provision_new_account RPC → redirect to /dashboard
  - Styling: match existing auth pages (clean, minimal, same logo)
  - Page title: "Start for free — Variation Shield"

- [ ] **Landing page CTAs: variationshield.com.au**
  - In `web/src/app/page.tsx`:
  - Hero section: replace single CTA with two CTAs:
    - Primary (full indigo button): "Try Free — No Credit Card" → /signup/free
    - Secondary (outlined): "Get Started — $299/mo" → existing Stripe link
  - Below pricing card: add a line "Not ready to commit? Try free with 3 variations — no credit card required." with a link to /signup/free
  - Sticky nav CTA: change to "Try Free" → /signup/free
  - Keep existing "Book a Demo" button where it exists

- [ ] **Free tier onboarding: first-login flow**
  - Detect first login (no projects exist) on dashboard load
  - Show onboarding prompt card at top of dashboard:
    - Step 1: "What project are you working on?" → inline mini-form (project name + client name) → creates project
    - Step 2: "Any scope changes not documented yet?" → CTA → /variation/new pre-linked to project
    - Step 3: Dismissed once user has logged ≥1 variation
  - Persist a subtle banner "Ready to log your first variation? →" in sidebar until first variation logged
  - After onboarding dismissed or completed, show usage counter in sidebar: "X of 3 free variations used"

- [ ] **Usage counter in sidebar**
  - Free users only: show "X / 3 variations used" below nav items in `web/src/components/Sidebar.tsx`
  - At 2/3: amber colour
  - At 3/3: red colour + "Upgrade to capture more →"
  - Pro users: no counter shown

- [ ] **Soft warning banners (free users only)**
  - After logging 2nd variation: subtle top banner "You've used 2 of 3 free variations."
  - After logging 3rd (final): success toast "Nice — 3 variations documented. Upgrade to keep capturing."
  - Implement in variation new/save success flow

- [ ] **Conversion wall modal**
  - Triggered when free user attempts to create a 4th variation
  - Show full-screen modal (not dismissable to create new variation):
  - Headline: "You've documented [X variations] worth $[Y] — want to keep going?"
    - X = their variation count, Y = sum of their estimated_values formatted as AUD
  - Body: "Upgrade to Pro and keep capturing — unlimited variations, projects, and team members."
  - Secondary line: "Or export what you have and go back to spreadsheets." (no shame, just honest)
  - CTAs:
    1. "Upgrade to Pro — $299/mo" → Stripe checkout (pre-fill email via URL param if possible)
    2. "Book a Demo →" → https://leveragedsystems.com.au/schedule
    3. "Export My Data" → CSV download of their variations (id, title, status, estimated_value, created_at, project name)
  - IMPORTANT: Modal blocks new creation only. User can still view/edit/export their existing 3 variations. Dashboard remains fully accessible.

- [ ] **Stripe upgrade flow**
  - When free user clicks "Upgrade to Pro", use existing Stripe checkout link: https://buy.stripe.com/3cI00j9wN8ZQ1Gs90XfrW02
  - On `checkout.session.completed` Stripe webhook (in `/api/webhooks/stripe` if it exists, otherwise create it):
    - Match by customer email
    - Update company: set plan='pro', variation_limit=null, project_limit=null, upgraded_at=now()
  - Handle edge case: user with existing free account clicks the homepage paid CTA → detect email match and upgrade rather than create duplicate
  - Check if Stripe webhook handler already exists before creating

- [ ] **Watermarked PDF**
  - In the Puppeteer PDF generation (`/api/generate-pdf`): detect if company plan='free'
  - If free: add a small footer line to the PDF: "Generated with Variation Shield — variationshield.com.au | Upgrade to Pro to remove this watermark"
  - Keep existing footer for Pro users unchanged
  - Free users can still generate and download PDFs — just watermarked

- [ ] **Team invite restriction (free users)**
  - In `web/src/app/team/page.tsx` (or wherever team invite UI lives):
  - If plan='free': replace "Invite Team Member" button with a locked state: "Field accounts available on Pro →" with upgrade link
  - Free user IS the only user — no invites allowed

- [ ] **CSV export function**
  - Used by conversion wall "Export My Data" button
  - Query user's variations with project names
  - Download as `variation-shield-export.csv` with columns: Variation #, Title, Status, Value ($), Project, Date Captured
  - Implement as a client-side function or a simple API route

- [ ] **Deploy and smoke test**
  - Apply migration 035 to production via Supabase SQL editor (note in commit message for Shane to apply)
  - `git add -A && git commit -m "Free tier: plan enforcement, signup flow, conversion wall, onboarding"`
  - `git push origin main` (post-commit hook auto-deploys)
  - Smoke test: sign up at /signup/free, create project, log 3 variations, hit conversion wall, verify export works
  - Verify existing Pro signup path (Stripe link) still works end-to-end

---

## Out of Scope (Do Not Build)

- Email drip sequences for free users
- Referral mechanics
- Annual billing
- Mobile PWA changes
- In-app chat for free users
- Trade/industry data collection at signup

---

## Notes for Linus

- Check existing `/api/webhooks/stripe` before creating a new one — may already exist from client approval flow
- The `provision_new_account` RPC in `supabase/migrations/022_signup_provision_fn.sql` — update it to set plan defaults, don't rewrite it
- Run `git log --oneline -5` before starting to orient on current state
- All migrations must be SQL files in `supabase/migrations/` — Shane applies them manually to prod
- Deploy rule: ALWAYS `git push origin main` — NEVER `vercel --prod`
- Test with the free signup flow before touching any existing Pro flows
