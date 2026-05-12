-- Migration 098: repoint algorithm_deployments.algorithm_id FK
-- The original constraint (mig 059) pointed to trading_algorithms (legacy),
-- but the wizard and the canonical lifecycle now write to algorithms.
-- Without this repoint, deploying a strategy created via the wizard raises
-- a foreign-key violation on INSERT into algorithm_deployments.

ALTER TABLE public.algorithm_deployments
  DROP CONSTRAINT IF EXISTS algorithm_deployments_algorithm_id_fkey;

ALTER TABLE public.algorithm_deployments
  ADD CONSTRAINT algorithm_deployments_algorithm_id_fkey
  FOREIGN KEY (algorithm_id) REFERENCES public.algorithms(id) ON DELETE CASCADE;
