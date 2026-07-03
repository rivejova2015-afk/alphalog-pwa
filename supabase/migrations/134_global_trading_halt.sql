-- Migration 134: kill-switch global
--
-- Hoy pausar "todo" requiere ir algoritmo por algoritmo (POST
-- /api/algorithms/[id]/control) o app de Fly por app de Fly. Esta tabla +
-- el endpoint /api/algorithms/global-halt dan un único botón de pánico:
-- activa `halted=true` para el user, fan-out de comandos 'pause' a TODOS
-- los bot_id con deployments activos (reusa bot_commands, el mismo canal
-- que ya usa /control — no requiere tocar código del bot MT5 ni de
-- coinarb), y bloquea /signal + /deploy mientras el halt esté activo.

BEGIN;

CREATE TABLE IF NOT EXISTS public.global_trading_halt (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  halted     BOOLEAN     NOT NULL DEFAULT false,
  halted_at  TIMESTAMPTZ,
  halted_by  UUID REFERENCES auth.users(id),
  resumed_at TIMESTAMPTZ,
  resumed_by UUID REFERENCES auth.users(id),
  reason     TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.global_trading_halt ENABLE ROW LEVEL SECURITY;

CREATE POLICY global_trading_halt_own
  ON public.global_trading_halt FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY global_trading_halt_service
  ON public.global_trading_halt FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;

NOTIFY pgrst, 'reload schema';
