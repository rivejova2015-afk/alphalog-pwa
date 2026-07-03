-- Execution slices — soporte para TWAP/VWAP/Implementation-Shortfall.
--
-- executeSignal() está atado 1:1 a una fila cme_signals (marca esa fila como
-- 'executed' al colocar la orden). Para slicing, cada slice es su propia fila
-- hija de una fila "padre" que representa el plan completo:
--   - Padre: status='executing' mientras hay slices pendientes, quantity=total.
--   - Hijas: parent_signal_id apunta al padre, slice_index/total_slices para
--     orden y contabilidad, scheduled_at = cuándo debe colocarse.
--
-- expires_at (default now()+30s desde la migration 078) no aplica a slices
-- futuras — el dispatcher/cron setea expires_at = scheduled_at + 2min
-- explícitamente al insertar.

ALTER TABLE public.cme_signals
  ADD COLUMN IF NOT EXISTS parent_signal_id UUID REFERENCES public.cme_signals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS slice_index INTEGER,
  ADD COLUMN IF NOT EXISTS total_slices INTEGER,
  ADD COLUMN IF NOT EXISTS execution_algo TEXT CHECK (execution_algo IN ('twap','vwap','is')),
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS cme_signals_scheduled_pending_idx
  ON public.cme_signals(scheduled_at)
  WHERE status = 'pending' AND scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS cme_signals_parent_idx
  ON public.cme_signals(parent_signal_id)
  WHERE parent_signal_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
