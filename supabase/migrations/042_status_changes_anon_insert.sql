-- MIGRATION 042: Anon INSERT policy for status_changes (email approval flow)
-- PROBLEM: /api/variation-response/route.ts inserts into status_changes using
-- createBrowserClient (RLS-enforced). There is no anon INSERT policy for
-- status_changes, so the INSERT silently fails → status_history doesn't update
-- → notifications page doesn't show the client's approval/rejection.
--
-- FIX: Add an anon INSERT policy scoped to variations that have an approval_token
-- (i.e. linked to an email-approval flow). No SELECT/UPDATE needed for anon.

BEGIN;

CREATE POLICY "Anon can insert status changes for approval flow"
ON public.status_changes
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.variations v
    WHERE v.id = variation_id
    AND v.approval_token IS NOT NULL
  )
);

COMMIT;
