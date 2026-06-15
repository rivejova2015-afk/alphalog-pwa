-- 121_backtest_jobs_realtime.sql
-- Add backtest_jobs to the supabase_realtime publication so the UI can
-- subscribe to per-job UPDATE events (current_phase + progress_pct) instead
-- of polling every 3s. The owner panel already filters by RLS so the channel
-- subscription is automatically scoped to the user's own jobs.
--
-- Idempotent: ALTER PUBLICATION fails when the table is already added, so we
-- check first via the catalog. Safe to rerun on environments where this has
-- already been applied via a prior workflow.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'backtest_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.backtest_jobs;
  END IF;
END $$;

-- The set REPLICA IDENTITY FULL emits the OLD row payload alongside the NEW
-- one on UPDATE events. Required when the consumer wants to compute deltas
-- (eg. show "Monte Carlo: 250 → 350 iterations"). For our phase progress
-- the NEW row is sufficient but REPLICA IDENTITY FULL is cheap on this
-- low-row-count table and gives us flexibility for future deltas.
ALTER TABLE public.backtest_jobs REPLICA IDENTITY FULL;
