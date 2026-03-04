-- 017_security_definer_search_path.sql
-- Fix: SECURITY DEFINER functions missing SET search_path
-- Supabase Security Advisor flags these as a function hijacking risk.
-- Setting search_path = '' prevents a malicious caller from shadowing
-- system functions by manipulating their own search_path.
-- All function bodies use fully qualified names (public.*, auth.*) so empty search_path is safe.
-- Apply via Supabase Dashboard → SQL Editor → Run

ALTER FUNCTION public.get_user_company_ids() SET search_path = '';
ALTER FUNCTION public.get_user_role(UUID) SET search_path = '';
ALTER FUNCTION public.accept_invitation(TEXT) SET search_path = '';
ALTER FUNCTION public.get_company_members(UUID) SET search_path = '';
ALTER FUNCTION public.get_user_emails(UUID[]) SET search_path = '';
ALTER FUNCTION public.update_member_role(UUID, TEXT) SET search_path = '';
ALTER FUNCTION public.remove_member(UUID) SET search_path = '';
