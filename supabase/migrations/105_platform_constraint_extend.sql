-- Migration 105: extend platform constraints to include Tradovate (futures
-- propfirm via CME) and IBKR (options). Without this, the wizard cannot
-- persist algorithms with a real execution venue for futures/options — they
-- end up tagged as MT5 even though MT5 has no path to those markets.
--
-- Two constraints to extend in lockstep:
--   1. algorithms.platform                        (scalar)
--   2. algorithm_templates.supported_platforms    (array)
--
-- Also re-tags templates by market_type so the UI shows the correct venue
-- in the wizard dropdown.

BEGIN;

-- 1) algorithms.platform — add Tradovate + IBKR alongside existing values
ALTER TABLE public.algorithms
  DROP CONSTRAINT IF EXISTS algorithms_platform_check;
ALTER TABLE public.algorithms
  ADD CONSTRAINT algorithms_platform_check
  CHECK (platform = ANY (ARRAY['MT4','MT5','Tradovate','IBKR','fly']));

-- 2) algorithm_templates.supported_platforms — same extension
ALTER TABLE public.algorithm_templates
  DROP CONSTRAINT IF EXISTS algorithm_templates_supported_platforms_check;
ALTER TABLE public.algorithm_templates
  ADD CONSTRAINT algorithm_templates_supported_platforms_check
  CHECK (
    array_length(supported_platforms, 1) >= 1
    AND supported_platforms <@ ARRAY['MT4','MT5','Tradovate','IBKR']::TEXT[]
  );

-- 3) Re-tag templates by market_type
UPDATE public.algorithm_templates
  SET supported_platforms = ARRAY['Tradovate']::TEXT[]
  WHERE market_type = 'futures';

UPDATE public.algorithm_templates
  SET supported_platforms = ARRAY['IBKR']::TEXT[]
  WHERE market_type = 'options';

COMMIT;
