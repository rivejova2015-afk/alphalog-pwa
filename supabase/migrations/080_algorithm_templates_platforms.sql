-- Migration 080: añade supported_platforms a algorithm_templates
-- Permite que un template declare en qué plataformas (MT4/MT5) está disponible.
-- GoldRangeBasketR queda como MT4 + MT5 (código fuente: MQL5; binding MT4 vía bridge).

BEGIN;

ALTER TABLE public.algorithm_templates
  ADD COLUMN IF NOT EXISTS supported_platforms TEXT[] NOT NULL DEFAULT ARRAY['MT5']::TEXT[];

ALTER TABLE public.algorithm_templates
  DROP CONSTRAINT IF EXISTS algorithm_templates_supported_platforms_check;

ALTER TABLE public.algorithm_templates
  ADD CONSTRAINT algorithm_templates_supported_platforms_check
  CHECK (
    array_length(supported_platforms, 1) >= 1
    AND supported_platforms <@ ARRAY['MT4','MT5']::TEXT[]
  );

UPDATE public.algorithm_templates
  SET supported_platforms = ARRAY['MT4','MT5']::TEXT[]
  WHERE template_key = 'goldrangebasketr';

COMMIT;
