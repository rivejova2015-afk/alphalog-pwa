-- 100_coinarb_algorithm_deployment.sql
-- =========================================================================
-- Fase C — create the algorithm_deployments row connecting the coinarb
-- algorithm (mig 099) to its bot_account so PUT /api/algorithms/[id] can
-- look up the bot_id and insert update_parameters commands.
--
-- Idempotent on (id).
-- =========================================================================

INSERT INTO public.algorithm_deployments (
  id, user_id, algorithm_id, bot_account_id, status, notes
)
VALUES (
  '33333333-c01a-4b00-9003-000000000001'::uuid,
  '304a1a34-36a9-4a75-ae52-3023409932f0',
  'a667d400-065f-4415-9609-373c3749e5fd'::uuid,           -- algorithms.id
  '22222222-c01a-4b00-9002-000000000001'::uuid,           -- bot_accounts.id from mig 099
  'active',
  'Auto-deployment for Coinarb 50x on Fly (sin region). Created by mig 100.'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = now();
