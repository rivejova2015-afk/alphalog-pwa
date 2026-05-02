-- 086_backtest_jobs.sql
-- Backtest job queue + progress tracking

CREATE TABLE IF NOT EXISTS public.backtest_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  algorithm_id   uuid REFERENCES public.algorithms(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued','running','completed','failed','cancelled')),
  config         jsonb NOT NULL,
  progress_pct   numeric(5,2) NOT NULL DEFAULT 0
                 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  current_phase  text,
  error          text,
  engine_version text NOT NULL DEFAULT 'v1',
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backtest_jobs_user_status
  ON public.backtest_jobs (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS backtest_jobs_algo
  ON public.backtest_jobs (algorithm_id, created_at DESC);

ALTER TABLE public.backtest_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY backtest_jobs_own ON public.backtest_jobs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY backtest_jobs_service ON public.backtest_jobs FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS backtest_jobs_set_updated_at ON public.backtest_jobs;
CREATE TRIGGER backtest_jobs_set_updated_at
  BEFORE UPDATE ON public.backtest_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
