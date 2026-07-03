-- Portfolio HRP allocations — persiste el resultado de cada corrida de
-- hrpAllocate() (src/lib/portfolio/hrp.ts) contra las series de retornos
-- diarios reales de los algoritmos activos (paper/live).
--
-- is_current=true marca la corrida vigente (una fila por algoritmo incluido
-- en esa corrida). Corridas viejas quedan con is_current=false para
-- historial/auditoría — no se borran.

CREATE TABLE IF NOT EXISTS public.portfolio_allocations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  lookback_days      INTEGER NOT NULL,
  algorithm_id       UUID NOT NULL REFERENCES public.algorithms(id) ON DELETE CASCADE,
  weight             NUMERIC NOT NULL CHECK (weight >= 0 AND weight <= 1),
  daily_return_stdev NUMERIC,
  is_current         BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_allocations_user_current_idx
  ON public.portfolio_allocations(user_id, is_current)
  WHERE is_current = true;
CREATE INDEX IF NOT EXISTS portfolio_allocations_run_idx
  ON public.portfolio_allocations(user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS portfolio_allocations_algorithm_idx
  ON public.portfolio_allocations(algorithm_id);

ALTER TABLE public.portfolio_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY portfolio_allocations_select ON public.portfolio_allocations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY portfolio_allocations_insert ON public.portfolio_allocations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY portfolio_allocations_update ON public.portfolio_allocations
  FOR UPDATE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
