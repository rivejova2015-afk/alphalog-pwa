-- 055_api_rate_limits_rls_hardening.sql
-- Remove all authenticated-user access policies from api_rate_limits
-- All access is exclusively through increment_api_rate_limit() security definer function

BEGIN;

-- Drop all open policies that allowed authenticated user access
DROP POLICY IF EXISTS api_rate_limits_select ON public.api_rate_limits;
DROP POLICY IF EXISTS api_rate_limits_insert ON public.api_rate_limits;
DROP POLICY IF EXISTS api_rate_limits_update ON public.api_rate_limits;

-- No replacement policies needed:
-- - The increment_api_rate_limit() RPC is security definer and bypasses RLS entirely
-- - Service role client (used in proxy.ts) also bypasses RLS automatically
-- - No client-facing authenticated code directly reads/writes api_rate_limits

COMMIT;
