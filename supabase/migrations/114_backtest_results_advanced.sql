-- Migration 114: backtest_results.advanced (jsonb)
--
-- Persiste el resultado del pipeline avanzado opt-in (ml-signal, multi-tf,
-- portfolio) introducido en Plan v2 — Bloque C. Cuando ningún flag está
-- activo, queda NULL. La columna es jsonb para acomodar el shape variable
-- de cada sub-resultado sin acoplar el schema a una sola estructura.

ALTER TABLE public.backtest_results
  ADD COLUMN IF NOT EXISTS advanced JSONB;

NOTIFY pgrst, 'reload schema';
