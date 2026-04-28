-- 039_fix_claim_type_constraint.sql
-- Problem: variations_claim_type_check only allowed 3 values (cost, time, cost_and_time)
-- but the frontend dropdown has 5 options (Lump Sum, Cost Plus, Schedule of Rates, Time Impact Only, Cost & Time)
-- Fix: update constraint to allow all 5 valid claim types

BEGIN;

ALTER TABLE public.variations DROP CONSTRAINT IF EXISTS variations_claim_type_check;

ALTER TABLE public.variations ADD CONSTRAINT variations_claim_type_check 
CHECK (claim_type IN ('lump_sum', 'cost_plus', 'schedule_of_rates', 'time_impact_only', 'cost_and_time'));

COMMIT;
