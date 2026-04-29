# Variation Shield staging/v2 deployment

## Objective

Production (`variationshield.com.au`) stays stable for the existing user. All redesign and v2 testing happens on the `variation-shield-v2-design` branch and a separate staging deployment.

## Branch model

- Production branch: `main`
- Staging/v2 branch: `variation-shield-v2-design`
- No v2 changes merge to `main` until Shane approves release.
- Production deploy remains the current GitHub/Vercel production deployment.

## Staging URL

Preferred:

- `https://staging.variationshield.com.au`

Fallback:

- `https://v2.variationshield.com.au`

Use a separate Vercel project for staging if possible. This prevents production env vars/domains from being reused accidentally.

Recommended project name: `variation-staging`

## Database isolation

Staging must use a separate Supabase project/database.

Do **not** use the production Supabase project ref currently used by production.

Required staging Supabase setup:

1. Create a new Supabase project for staging.
2. Apply the existing migrations to that project only.
3. Configure staging auth redirect URLs:
   - `https://staging.variationshield.com.au/**`
   - local dev URL if needed.
4. Load `web/.env.staging` or set the same values in the Vercel staging project.
5. Run the seed script against staging only.

The seed script refuses to run unless `NEXT_PUBLIC_DEPLOY_ENV`/`VERCEL_ENV` is staging-like and the Supabase URL does not match the known production project ref.

## Environment files

Local templates:

- `web/.env.production.example`
- `web/.env.staging.example`

Local real files are intentionally gitignored:

- `web/.env.production`
- `web/.env.staging`

Vercel environments should mirror those files:

### Production

- `NEXT_PUBLIC_DEPLOY_ENV=production`
- Production Supabase URL + anon key
- Production Supabase service role key
- Live Stripe checkout/webhook values
- `EMAIL_MODE=live`
- Production Resend settings
- No staging basic auth values

### Staging

- `NEXT_PUBLIC_DEPLOY_ENV=staging`
- Staging Supabase URL + anon key
- Staging Supabase service role key
- Stripe test checkout/webhook values only
- `EMAIL_MODE=redirect` or `EMAIL_MODE=disabled`
- `STAGING_EMAIL_RECIPIENT=<Shane test email>`
- `STAGING_BASIC_AUTH_USER=<username>`
- `STAGING_BASIC_AUTH_PASSWORD=<strong password>`

If staging basic auth values are missing, middleware returns `503` rather than exposing the staging site.

## Access protection

Staging is protected in middleware by HTTP Basic Auth when any of these are true:

- `NEXT_PUBLIC_DEPLOY_ENV=staging`
- `VERCEL_ENV=preview`
- host starts with `staging.`
- host starts with `v2.`

This prevents the existing production user or the public from accidentally opening the staging app.

## Noindex/nofollow

Staging adds:

- `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`
- Next.js metadata robots: noindex/nofollow/nocache

## External action sandboxing

Staging code supports:

- `EMAIL_MODE=redirect` — all outbound emails go to `STAGING_EMAIL_RECIPIENT` with a staging banner showing original intended recipients.
- `EMAIL_MODE=disabled` — outbound emails are skipped.
- Stripe checkout links use `NEXT_PUBLIC_STRIPE_TEST_CHECKOUT_URL` in staging; if absent they fall back to `/schedule`, not live Stripe.

Covered email paths:

- demo requests
- feedback
- variation send-to-client emails
- notice send-to-client emails
- approval/rejection PM notifications
- approver receipts

## Seed staging demo data

From `web/` after loading staging env vars:

```bash
cd web
set -a
source .env.staging
set +a
npm run seed:staging
```

Seed data includes:

- 4 projects
- draft, submitted, approved, disputed and overdue submitted variations
- realistic Victorian construction project/client names
- realistic values
- manager, office, and field users

The script prints demo logins after completion.

## Suggested Vercel setup

Use a separate staging project:

```bash
# from repo root
vercel link --project variation-staging --scope team_WQNtR40cO1YqKCenBG7dAsPz
vercel env add NEXT_PUBLIC_DEPLOY_ENV preview
# Add all values from web/.env.staging.example as preview/staging env vars
vercel domains add staging.variationshield.com.au --scope team_WQNtR40cO1YqKCenBG7dAsPz
```

Then deploy only the v2 branch to staging.

Do **not** run production deploys from the staging project.

## Production release checklist

Before merging v2 into `main`:

- [ ] Confirm staging uses the staging Supabase URL, not production.
- [ ] Confirm production remains on `main` and live user data is unchanged.
- [ ] Test login.
- [ ] Test dashboard.
- [ ] Test create variation.
- [ ] Test send/preview approval.
- [ ] Test PDF generation.
- [ ] Test user/project data.
- [ ] Test mobile layout.
- [ ] Confirm emails are live only in production.
- [ ] Confirm Stripe is live only in production and test mode only in staging.
- [ ] Confirm noindex is absent from production and present in staging.
- [ ] Get Shane approval.
- [ ] Merge `variation-shield-v2-design` into `main`.
- [ ] Let GitHub/Vercel production deploy from `main`.
